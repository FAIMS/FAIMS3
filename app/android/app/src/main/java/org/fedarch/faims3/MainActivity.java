package org.fedarch.faims3;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Cap 8: keep edge-to-edge; insets are handled via CSS env(safe-area-inset-*).
    // StatusBar overlaysWebView/backgroundColor are no-ops on Android 16+ (API 36).
    EdgeToEdge.enable(this);
    WebView.setWebContentsDebuggingEnabled(true);
  }
}
