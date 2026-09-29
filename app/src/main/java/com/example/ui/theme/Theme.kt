package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryCyan,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryContainer,
    onPrimaryContainer = OnPrimaryContainer,
    secondary = SecondaryLilac,
    onSecondary = OnSecondary,
    secondaryContainer = SecondaryContainer,
    onSecondaryContainer = OnSecondaryContainer,
    tertiary = StatusGreen,
    onTertiary = OnStatusGreen,
    tertiaryContainer = StatusGreenContainer,
    onTertiaryContainer = StatusGreen,
    error = AlertRed,
    onError = OnAlertRed,
    errorContainer = AlertRedContainer,
    onErrorContainer = OnAlertRedContainer,
    background = SurfaceCanvas,
    onBackground = TextPrimary,
    surface = SurfaceCanvas,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceContainerHigh,
    onSurfaceVariant = TextSecondary,
    outline = BorderOutline,
    outlineVariant = BorderOutlineVariant,
    surfaceContainerLowest = SurfaceContainerLowest,
    surfaceContainerLow = SurfaceContainerLow,
    surfaceContainer = SurfaceContainer,
    surfaceContainerHigh = SurfaceContainerHigh,
    surfaceContainerHighest = SurfaceContainerHighest,
    surfaceBright = SurfaceBright
)

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}

@Composable
fun AIStudioLiveCommerceTheme(
    content: @Composable () -> Unit
) {
    MyApplicationTheme(content = content)
}

