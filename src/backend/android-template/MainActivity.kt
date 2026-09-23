package com.persobuilder.app

import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Android 16 fuerza edge-to-edge con target SDK 36. Las barras quedan
    // transparentes y muestran este fondo, con iconos claros en ambos temas.
    window.statusBarColor = Color.rgb(2, 7, 11)
    window.navigationBarColor = Color.rgb(2, 7, 11)
    window.decorView.setBackgroundColor(Color.rgb(2, 7, 11))
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = false
      isAppearanceLightNavigationBars = false
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    var lastImeHeight = -1
    var lastImeVisible = false

    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
      val systemBars = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
      )
      val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
      val imeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime())
      val bottomSystemInset = if (imeVisible) 0 else systemBars.bottom
      val layoutParams = view.layoutParams

      if (layoutParams is ViewGroup.MarginLayoutParams) {
        layoutParams.leftMargin = systemBars.left
        // El WebView se ancla siempre arriba. Android puede mostrar la barra de
        // estado junto al teclado; aplicarla como margen desplazaría toda la UI.
        layoutParams.topMargin = systemBars.top
        layoutParams.rightMargin = systemBars.right
        layoutParams.bottomMargin = bottomSystemInset
        view.layoutParams = layoutParams
      }

      if (lastImeHeight != ime.bottom || lastImeVisible != imeVisible) {
        lastImeHeight = ime.bottom
        lastImeVisible = imeVisible
        val imeHeightCssPixels = ime.bottom / webView.resources.displayMetrics.density
        webView.evaluateJavascript(
          """
            (() => {
              const detail = { height: $imeHeightCssPixels, visible: $imeVisible };
              window.__DRAFTLAB_ANDROID_IME__ = detail;
              window.dispatchEvent(new CustomEvent('draftlab:ime-inset', { detail }));
            })();
          """.trimIndent(),
          null,
        )
      }

      // El layout nativo gestiona estos margenes y evita que WebView los aplique
      // una segunda vez mediante CSS. El teclado se superpone sin redimensionarlo.
      windowInsets.inset(
        systemBars.left,
        systemBars.top,
        systemBars.right,
        bottomSystemInset,
      )
    }

    ViewCompat.requestApplyInsets(webView)
  }
}
