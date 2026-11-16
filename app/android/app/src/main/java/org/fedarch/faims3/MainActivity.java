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
    // Before super.onCreate: BridgeActivity registers plugins while loading.
    registerPlugin(MapFileRangePlugin.class);
    super.onCreate(savedInstanceState);
    EdgeToEdge.enable(this);
    WebView.setWebContentsDebuggingEnabled(true);
  }
}
