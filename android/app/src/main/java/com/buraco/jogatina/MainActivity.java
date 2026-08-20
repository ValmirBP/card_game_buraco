package com.buraco.jogatina;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Fundo da janela = verde do feltro, pra qualquer área não coberta pela
        // WebView (ex.: faixa do recorte da câmera) não aparecer branca/preta.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#0f5132")));
        // Desenha também na área do recorte da câmera (edge-to-edge real): em
        // paisagem, sem isso sobra uma faixa nas bordas onde fica o notch.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            // ALWAYS (API 30+), não SHORT_EDGES: SHORT_EDGES só deixa o
            // conteúdo entrar no recorte das bordas CURTAS. Neste jogo, que
            // roda travado em paisagem, o furo da câmera fica numa borda
            // LATERAL - com SHORT_EDGES a janela era recuada ali e sobrava
            // uma faixa onde a moldura de madeira da mesa não chegava,
            // mostrando o fundo liso da janela. Com ALWAYS a WebView cobre a
            // tela inteira e a moldura acompanha a borda real do aparelho.
            // Os elementos que ficariam ATRÁS do furo já se protegem sozinhos
            // com env(safe-area-inset-*) (ver GameBoard.tsx).
            lp.layoutInDisplayCutoutMode =
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Reaplica o modo imersivo sempre que a janela recupera o foco — as
        // barras de sistema (status/navegação) voltam ao aparecer teclado,
        // notificação, etc., então precisamos escondê-las de novo.
        if (hasFocus) {
            hideSystemBars();
        }
    }

    /** Tela cheia "imersiva": esconde a barra de status e a barra/gesto de
     * navegação (os controles de sistema do Android). No Android 11+ (API 30)
     * usa o WindowInsetsController moderno; abaixo disso, cai no antigo
     * setSystemUiVisibility. As barras reaparecem com um swipe da borda e
     * somem de novo sozinhas. */
    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            View decor = getWindow().getDecorView();
            decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }
}
