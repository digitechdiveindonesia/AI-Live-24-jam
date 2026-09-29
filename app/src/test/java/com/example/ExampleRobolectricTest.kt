package com.example

import android.app.Application
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("AI Live Commerce", appName)
  }

  @Test
  fun `test viewModel emergency stop and product resolution`() = runBlocking {
    val app = ApplicationProvider.getApplicationContext<Context>() as Application
    val vm = com.example.viewmodel.LiveCommerceViewModel(app)
    assertEquals("LIVE-001", vm.session.value.id)
    assertEquals(true, vm.session.value.isLive)

    // Trigger Emergency Stop
    vm.triggerEmergencyStop()
    assertEquals(true, vm.showEmergencyDialog.value)
    vm.confirmEmergencyHalt()
    assertEquals(false, vm.session.value.isLive)
    assertEquals(false, vm.session.value.isAiHostOn)

    // Resolve stock conflict
    vm.resolveStockConflict("SAFE_FLOOR")
    val sku4 = vm.products.value.first { it.sku == "SKU-004" }
    assertEquals(6, sku4.totalStock)
    assertEquals("CLAMPED_SAFE", sku4.syncStatus)
  }
}
