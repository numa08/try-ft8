// テキスト(フリーテキスト)を 15 秒スロットの float PCM にエンコードする WASM シム。
// パイプラインは ft8_lib の demo/gen_ft8.c に準拠: encode_free -> ft8_encode(tones) -> synth_gfsk。
// gfsk_pulse / synth_gfsk は gen_ft8.c から複製(ライブラリ側には無いため)。
//
// Portions derived from ft8_lib (https://github.com/kgoba/ft8_lib),
// Copyright (c) 2018 Kārlis Goba, MIT License. See THIRD_PARTY_LICENSES.md.
#include <stdint.h>
#include <string.h>
#include <math.h>

#include <ft8/message.h>
#include <ft8/encode.h>
#include <ft8/constants.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#define FT8_SYMBOL_BT 2.0f      ///< FT8 の GFSK 平滑化フィルタ帯域係数
#define GFSK_CONST_K 5.336446f  ///< pi * sqrt(2 / log(2))

static void gfsk_pulse(int n_spsym, float symbol_bt, float* pulse)
{
    for (int i = 0; i < 3 * n_spsym; ++i)
    {
        float t = i / (float)n_spsym - 1.5f;
        float arg1 = GFSK_CONST_K * symbol_bt * (t + 0.5f);
        float arg2 = GFSK_CONST_K * symbol_bt * (t - 0.5f);
        pulse[i] = (erff(arg1) - erff(arg2)) / 2;
    }
}

static void synth_gfsk(const uint8_t* symbols, int n_sym, float f0, float symbol_bt,
                       float symbol_period, int signal_rate, float* signal)
{
    int n_spsym = (int)(0.5f + signal_rate * symbol_period);
    int n_wave = n_sym * n_spsym;
    float hmod = 1.0f;

    float dphi_peak = 2 * M_PI * hmod / n_spsym;
    float dphi[n_wave + 2 * n_spsym];

    for (int i = 0; i < n_wave + 2 * n_spsym; ++i)
    {
        dphi[i] = 2 * M_PI * f0 / signal_rate;
    }

    float pulse[3 * n_spsym];
    gfsk_pulse(n_spsym, symbol_bt, pulse);

    for (int i = 0; i < n_sym; ++i)
    {
        int ib = i * n_spsym;
        for (int j = 0; j < 3 * n_spsym; ++j)
        {
            dphi[j + ib] += dphi_peak * symbols[i] * pulse[j];
        }
    }

    for (int j = 0; j < 2 * n_spsym; ++j)
    {
        dphi[j] += dphi_peak * pulse[j + n_spsym] * symbols[0];
        dphi[j + n_sym * n_spsym] += dphi_peak * pulse[j] * symbols[n_sym - 1];
    }

    float phi = 0;
    for (int k = 0; k < n_wave; ++k)
    {
        signal[k] = sinf(phi);
        phi = fmodf(phi + dphi[k + n_spsym], 2 * M_PI);
    }

    int n_ramp = n_spsym / 8;
    for (int i = 0; i < n_ramp; ++i)
    {
        float env = (1 - cosf(2 * M_PI * i / (2 * n_ramp))) / 2;
        signal[i] *= env;
        signal[n_wave - 1 - i] *= env;
    }
}

// フリーテキストを 15 秒スロットにパディングした float PCM へエンコードする。
// out には両端に無音を付けた 15 秒分(slot_time * sample_rate サンプル)を書き込む。
// 成功時は書き込んだサンプル数、引数不正は -1、パック失敗は -2、容量不足は -3 を返す。
EMSCRIPTEN_KEEPALIVE
int ft8_encode_samples(const char* text, float freq_hz, int sample_rate, float* out, int out_cap)
{
    if (text == NULL || out == NULL || out_cap <= 0 || sample_rate <= 0)
        return -1;

    ftx_message_t msg;
    ftx_message_rc_t rc = ftx_message_encode_free(&msg, text);
    if (rc != FTX_MESSAGE_RC_OK)
        return -2;

    uint8_t tones[FT8_NN];
    ft8_encode(msg.payload, tones);

    float symbol_period = FT8_SYMBOL_PERIOD;
    int num_samples = (int)(0.5f + FT8_NN * symbol_period * sample_rate);
    int num_silence = (int)((FT8_SLOT_TIME * sample_rate - num_samples) / 2);
    if (num_silence < 0)
        num_silence = 0;
    int total = num_silence + num_samples + num_silence;
    if (total > out_cap)
        return -3;

    for (int i = 0; i < total; ++i)
        out[i] = 0.0f;

    synth_gfsk(tones, FT8_NN, freq_hz, FT8_SYMBOL_BT, symbol_period, sample_rate, out + num_silence);
    return total;
}
