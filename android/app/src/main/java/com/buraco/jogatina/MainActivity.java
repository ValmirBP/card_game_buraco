package com.buraco.jogatina;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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

    /** Tela cheia "imersiva": esconde a barra de status e a barra de navegação
     * (os botões de menu do Android). As barras reaparecem com um swipe da
     * borda e somem de novo sozinhas (STICKY). */
    private void hideSystemBars() {
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
