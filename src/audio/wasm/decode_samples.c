// T1 spike: decode FT8 from an in-memory PCM buffer (for browser/WASM use).
// Reuses ft8_lib's public decode API + a callsign hashtable copied from the
// demo (demo/decode_ft8.c). Output: newline-separated decoded message texts.
#include <stdint.h>
#include <string.h>
#include <stdio.h>
#include <math.h>
#include <stdbool.h>

#include <ft8/decode.h>
#include <ft8/message.h>
#include <common/monitor.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

static const int kMin_score = 10;
static const int kMax_candidates = 140;
static const int kLDPC_iterations = 25;
static const int kMax_decoded_messages = 50;
static const int kFreq_osr = 2;
static const int kTime_osr = 2;

#define CALLSIGN_HASHTABLE_SIZE 256

static struct
{
    char callsign[12];
    uint32_t hash;
} callsign_hashtable[CALLSIGN_HASHTABLE_SIZE];

static int callsign_hashtable_size;

static void hashtable_init(void)
{
    callsign_hashtable_size = 0;
    memset(callsign_hashtable, 0, sizeof(callsign_hashtable));
}

static void hashtable_add(const char* callsign, uint32_t hash)
{
    uint16_t hash10 = (hash >> 12) & 0x3FFu;
    int idx_hash = (hash10 * 23) % CALLSIGN_HASHTABLE_SIZE;
    while (callsign_hashtable[idx_hash].callsign[0] != '\0')
    {
        if (((callsign_hashtable[idx_hash].hash & 0x3FFFFFu) == hash) && (0 == strcmp(callsign_hashtable[idx_hash].callsign, callsign)))
        {
            callsign_hashtable[idx_hash].hash &= 0x3FFFFFu;
            return;
        }
        idx_hash = (idx_hash + 1) % CALLSIGN_HASHTABLE_SIZE;
    }
    callsign_hashtable_size++;
    strncpy(callsign_hashtable[idx_hash].callsign, callsign, 11);
    callsign_hashtable[idx_hash].callsign[11] = '\0';
    callsign_hashtable[idx_hash].hash = hash;
}

static bool hashtable_lookup(ftx_callsign_hash_type_t hash_type, uint32_t hash, char* callsign)
{
    uint8_t hash_shift = (hash_type == FTX_CALLSIGN_HASH_10_BITS) ? 12 : (hash_type == FTX_CALLSIGN_HASH_12_BITS ? 10 : 0);
    uint16_t hash10 = (hash >> (12 - hash_shift)) & 0x3FFu;
    int idx_hash = (hash10 * 23) % CALLSIGN_HASHTABLE_SIZE;
    while (callsign_hashtable[idx_hash].callsign[0] != '\0')
    {
        if (((callsign_hashtable[idx_hash].hash & 0x3FFFFFu) >> hash_shift) == hash)
        {
            strcpy(callsign, callsign_hashtable[idx_hash].callsign);
            return true;
        }
        idx_hash = (idx_hash + 1) % CALLSIGN_HASHTABLE_SIZE;
    }
    callsign[0] = '\0';
    return false;
}

static ftx_callsign_hash_interface_t hash_if = {
    .lookup_hash = hashtable_lookup,
    .save_hash = hashtable_add
};

// Decode FT8 from a float PCM buffer. Writes newline-separated message texts
// into `out` (NUL-terminated, bounded by out_cap). Returns count of decoded
// messages, or -1 on bad args.
EMSCRIPTEN_KEEPALIVE
int ft8_decode_samples(const float* signal, int num_samples, int sample_rate, char* out, int out_cap)
{
    if (signal == NULL || out == NULL || out_cap <= 0 || num_samples <= 0)
        return -1;

    out[0] = '\0';
    int out_len = 0;

    monitor_t mon;
    monitor_config_t mon_cfg = {
        .f_min = 200,
        .f_max = 3000,
        .sample_rate = sample_rate,
        .time_osr = kTime_osr,
        .freq_osr = kFreq_osr,
        .protocol = FTX_PROTOCOL_FT8
    };

    hashtable_init();
    monitor_init(&mon, &mon_cfg);

    for (int frame_pos = 0; frame_pos + mon.block_size <= num_samples; frame_pos += mon.block_size)
    {
        monitor_process(&mon, signal + frame_pos);
    }

    const ftx_waterfall_t* wf = &mon.wf;
    ftx_candidate_t candidate_list[kMax_candidates];
    int num_candidates = ftx_find_candidates(wf, kMax_candidates, candidate_list, kMin_score);

    int num_decoded = 0;
    ftx_message_t decoded[kMax_decoded_messages];
    ftx_message_t* decoded_hashtable[kMax_decoded_messages];
    for (int i = 0; i < kMax_decoded_messages; ++i)
        decoded_hashtable[i] = NULL;

    for (int idx = 0; idx < num_candidates; ++idx)
    {
        const ftx_candidate_t* cand = &candidate_list[idx];

        ftx_message_t message;
        ftx_decode_status_t status;
        if (!ftx_decode_candidate(wf, cand, kLDPC_iterations, &message, &status))
            continue;

        int idx_hash = message.hash % kMax_decoded_messages;
        bool found_empty_slot = false;
        bool found_duplicate = false;
        do
        {
            if (decoded_hashtable[idx_hash] == NULL)
            {
                found_empty_slot = true;
            }
            else if ((decoded_hashtable[idx_hash]->hash == message.hash) && (0 == memcmp(decoded_hashtable[idx_hash]->payload, message.payload, sizeof(message.payload))))
            {
                found_duplicate = true;
            }
            else
            {
                idx_hash = (idx_hash + 1) % kMax_decoded_messages;
            }
        } while (!found_empty_slot && !found_duplicate);

        if (found_empty_slot)
        {
            memcpy(&decoded[idx_hash], &message, sizeof(message));
            decoded_hashtable[idx_hash] = &decoded[idx_hash];
            ++num_decoded;

            char text[FTX_MAX_MESSAGE_LENGTH];
            ftx_message_offsets_t offsets;
            ftx_message_rc_t unpack_status = ftx_message_decode(&message, &hash_if, text, &offsets);
            if (unpack_status != FTX_MESSAGE_RC_OK)
                continue;

            // 1行 = "snr\tfreq_hz\tmessage\n"。snr は Costas 同期スコアからの近似(dB)、
            // freq_hz はサブバンド音声周波数(AC-18 の最小周波数選択に使う)。
            float snr = cand->score * 0.5f;
            float freq_hz = (mon.min_bin + cand->freq_offset + (float)cand->freq_sub / wf->freq_osr) / mon.symbol_period;
            char line[80];
            int m_len = snprintf(line, sizeof(line), "%.1f\t%.1f\t%s\n", snr, freq_hz, text);
            if (m_len > 0 && out_len + m_len < out_cap)
            {
                memcpy(out + out_len, line, (size_t)m_len);
                out_len += m_len;
                out[out_len] = '\0';
            }
        }
    }

    monitor_free(&mon);
    return num_decoded;
}
