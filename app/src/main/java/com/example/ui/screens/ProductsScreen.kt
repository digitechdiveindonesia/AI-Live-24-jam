package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.ProductItem
import com.example.ui.theme.*

@Composable
fun ProductsScreen(
    products: List<ProductItem>,
    selectedProduct: ProductItem,
    onSelectProduct: (ProductItem) -> Unit,
    onResolveConflict: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showDetailDrawer by remember { mutableStateOf(false) }
    var activeInspectProduct by remember { mutableStateOf(selectedProduct) }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(SurfaceCanvas)
            .padding(24.dp)
    ) {
        val isWide = maxWidth >= 960.dp

        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // MAIN COMMERCE TABLE
            Surface(
                color = SurfaceContainerLowest,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                modifier = Modifier
                    .weight(if (showDetailDrawer && isWide) 1.2f else 1f)
                    .fillMaxHeight()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "COMMERCE CATALOG",
                                color = TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = "${products.size} Products in Live Rotation",
                                color = TextTertiary,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Text(
                            text = "Click product to view details",
                            color = PrimaryCyan,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    // Table Column Headers
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("PRODUCT", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(2f))
                        Text("PRICE", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1.2f))
                        Text("PROMO", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                        Text("STOCK", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                        Text("STATUS", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                    }

                    // Table Rows
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(products) { item ->
                            val isSelected = item.id == activeInspectProduct.id && showDetailDrawer

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(if (isSelected) SurfaceContainerHigh else SurfaceContainerLow)
                                    .border(
                                        1.dp,
                                        if (isSelected) PrimaryCyan else BorderOutlineVariant,
                                        RoundedCornerShape(6.dp)
                                    )
                                    .clickable {
                                        activeInspectProduct = item
                                        onSelectProduct(item)
                                        showDetailDrawer = true
                                    }
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Product Name & SKU
                                Column(modifier = Modifier.weight(2f)) {
                                    Text(item.title, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                                    Text(item.sku, color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                }

                                // Price
                                Text(
                                    text = "Rp${item.basePrice}",
                                    color = TextPrimary,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.weight(1.2f)
                                )

                                // Promo
                                Box(modifier = Modifier.weight(1f)) {
                                    if (item.promoBadge != null) {
                                        Text(
                                            text = item.promoBadge,
                                            color = AlertRed,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    } else {
                                        Text("None", color = TextTertiary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                    }
                                }

                                // Stock
                                Text(
                                    text = "${item.totalStock} units",
                                    color = if (item.isLowStock) WarningYellow else TextSecondary,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.weight(1f)
                                )

                                // Status
                                Box(modifier = Modifier.weight(1f)) {
                                    when {
                                        item.isOnAir -> Text("ON AIR", color = StatusGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                        item.conflict != null -> Text("CONFLICT", color = WarningYellow, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                        else -> Text("SYNCED", color = TextTertiary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // PRODUCT DETAIL DRAWER / SIDE SHEET
            if (showDetailDrawer) {
                Surface(
                    color = SurfaceContainerLowest,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                ) {
                    ProductDetailDrawerContent(
                        product = activeInspectProduct,
                        onClose = { showDetailDrawer = false },
                        onResolveConflict = onResolveConflict
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductDetailDrawerContent(
    product: ProductItem,
    onClose: () -> Unit,
    onResolveConflict: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Drawer Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "PRODUCT DETAILS",
                color = TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.5.sp
            )

            IconButton(onClick = onClose, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = TextSecondary, modifier = Modifier.size(18.dp))
            }
        }

        Divider(color = BorderOutlineVariant, thickness = 0.5.dp)

        // General Information
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(product.title, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("${product.brand} • ${product.category}", color = TextSecondary, fontSize = 12.sp)
            Text("BPOM: ${product.bpomNumber}", color = PrimaryCyan, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
        }

        // Pricing & Stock summary
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text("PRICE", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                Text("Rp${product.basePrice}", color = StatusGreen, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            }
            Column {
                Text("STOCK", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                Text("${product.totalStock} units", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            }
            Column {
                Text("VARIANTS", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                Text("${product.variants.size} options", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            }
        }

        // Stock Conflict Resolution (If conflict exists)
        if (product.conflict != null) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(WarningYellowContainer.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                    .border(1.dp, WarningYellow.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("STOCK DISCREPANCY DETECTED", color = WarningYellow, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                Text("Internal ERP: ${product.conflict.internalStock} | Shopee: ${product.conflict.shopeeStock}", color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Button(
                        onClick = { onResolveConflict("SAFE_FLOOR") },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryCyan, contentColor = VoidBlack),
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier.weight(1f).height(32.dp)
                    ) {
                        Text("Safe Floor (6)", fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                    }
                    Button(
                        onClick = { onResolveConflict("INTERNAL") },
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier.weight(1f).height(32.dp)
                    ) {
                        Text("ERP (8)", fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }
        }

        // Variants list
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("VARIANTS & INVENTORY", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
            product.variants.forEach { v ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceContainerLow, RoundedCornerShape(4.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(v.name, color = TextPrimary, fontSize = 11.sp)
                    Text("${v.stock} pcs", color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }
    }
}
