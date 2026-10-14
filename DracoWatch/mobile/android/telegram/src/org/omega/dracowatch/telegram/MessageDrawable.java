/*
 * Derived from Telegram for Android, upstream f32ffeec763f0bdbf4bec25b52d654f77bff733d.
 * Copyright Nikolai Kudashov and Telegram contributors. GPL-2.0-or-later.
 * Watch adaptation: explicit Context/density/colors instead of Telegram globals.
 * See TELEGRAM-PROVENANCE.md and telegram/LICENSE for source and modifications.
 */
package org.omega.dracowatch.telegram;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;

/** Telegram's actual incoming/outgoing bubble path renderer, using Watch colors. */
public final class MessageDrawable extends Drawable {
    public static final int TYPE_TEXT = 0;
    public static final int TYPE_MEDIA = 1;
    public static final int TYPE_PREVIEW = 2;
    private final float density;
    private final boolean isOut;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF rect = new RectF();
    private int currentType = TYPE_TEXT;
    private int bubbleRadius = 12;
    private boolean isTopNear, isBottomNear, botButtonsBottom;
    private boolean drawFullBubble = true;
    // These upstream viewport fields are retained for the exact generator, but
    // Watch draws complete bounded cells rather than cropped background slices.
    private int topY, currentBackgroundHeight;

    public MessageDrawable(Context context, boolean outgoing, int color) {
        density = context.getResources().getDisplayMetrics().density;
        isOut = outgoing;
        paint.setColor(color);
    }
    public void setColor(int color) { paint.setColor(color); invalidateSelf(); }
    public void setAdjacent(boolean topNear, boolean bottomNear) {
        isTopNear = topNear;
        isBottomNear = bottomNear;
        invalidateSelf();
    }
    public void setBotButtonsBottom(boolean value) { botButtonsBottom = value; invalidateSelf(); }
    public void setBubbleRadius(int radiusDp) {
        bubbleRadius = Math.max(0, Math.min(32, radiusDp));
        invalidateSelf();
    }
    public void setType(int type) {
        if (type < TYPE_TEXT || type > TYPE_PREVIEW) throw new IllegalArgumentException("Unknown bubble type");
        currentType = type;
        invalidateSelf();
    }
    public Path makePath() {
        Rect bounds = getBounds();
        int radius = dp(currentType == TYPE_PREVIEW ? 6 : bubbleRadius);
        int nearRadius = dp(Math.min(6, bubbleRadius));
        generatePath(path, bounds, dp(2), radius, dp(6), nearRadius,
            Math.max(bounds.top, 0), true, true, true);
        return path;
    }
    @Override public void draw(Canvas canvas) { canvas.drawPath(makePath(), paint); }
    @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); invalidateSelf(); }
    @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); invalidateSelf(); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    private int dp(float value) { return value == 0 ? 0 : (int) Math.ceil(density * value); }

    private void generatePath(Path path, Rect bounds, int padding, int rad, int smallRad, int nearRad, int top, boolean drawFullBottom, boolean drawFullTop, boolean customPaint) {
        path.rewind();
        int heightHalf = (bounds.height() - padding) >> 1;
        if (rad > heightHalf) {
            rad = heightHalf;
        }
        if (isOut) {
            // LEFT-BOTTOM <- RIGHT-BOTTOM
            if (drawFullBubble || currentType == TYPE_PREVIEW || customPaint || drawFullBottom) {
                int radToUse = botButtonsBottom ? nearRad : rad;
                if (currentType == TYPE_MEDIA) {
                    path.moveTo(bounds.right - dp(8) - radToUse, bounds.bottom - padding);
                } else {
                    path.moveTo(bounds.right - dp(2.6f), bounds.bottom - padding);
                }
                path.lineTo(bounds.left + padding + radToUse, bounds.bottom - padding);
                rect.set(bounds.left + padding, bounds.bottom - padding - radToUse * 2, bounds.left + padding + radToUse * 2, bounds.bottom - padding);
                path.arcTo(rect, 90, 90, false);
            } else {
                path.moveTo(bounds.right - dp(8), top - topY + currentBackgroundHeight);
                path.lineTo(bounds.left + padding, top - topY + currentBackgroundHeight);
            }
            if (drawFullBubble || currentType == TYPE_PREVIEW || customPaint || drawFullTop) {
                // LEFT-BOTTOM -> LEFT-TOP
                path.lineTo(bounds.left + padding, bounds.top + padding + rad);
                rect.set(bounds.left + padding, bounds.top + padding, bounds.left + padding + rad * 2, bounds.top + padding + rad * 2);
                path.arcTo(rect, 180, 90, false);

                // LEFT-TOP -> RIGHT-TOP
                int radToUse = isTopNear ? nearRad : rad;
                if (currentType == TYPE_MEDIA) {
                    path.lineTo(bounds.right - padding - radToUse, bounds.top + padding);
                    rect.set(bounds.right - padding - radToUse * 2, bounds.top + padding, bounds.right - padding, bounds.top + padding + radToUse * 2);
                } else {
                    path.lineTo(bounds.right - dp(8) - radToUse, bounds.top + padding);
                    rect.set(bounds.right - dp(8) - radToUse * 2, bounds.top + padding, bounds.right - dp(8), bounds.top + padding + radToUse * 2);
                }
                path.arcTo(rect, 270, 90, false);
            } else {
                // LEFT-BOTTOM -> LEFT-TOP
                path.lineTo(bounds.left + padding, top - topY - dp(2));

                // LEFT-TOP -> RIGHT-TOP
                if (currentType == TYPE_MEDIA) {
                    path.lineTo(bounds.right - padding, top - topY - dp(2));
                } else {
                    path.lineTo(bounds.right - dp(8), top - topY - dp(2));
                }
            }
            // RIGHT-TOP -> RIGHT-BOTTOM
            if (currentType == TYPE_MEDIA) {
                if (customPaint || drawFullBottom) {
                    int radToUse = isBottomNear ? nearRad : rad;

                    path.lineTo(bounds.right - padding, bounds.bottom - padding - radToUse);
                    rect.set(bounds.right - padding - radToUse * 2, bounds.bottom - padding - radToUse * 2, bounds.right - padding, bounds.bottom - padding);
                    path.arcTo(rect, 0, 90, false);
                } else {
                    path.lineTo(bounds.right - padding, top - topY + currentBackgroundHeight);
                }
            } else {
                if (drawFullBubble || currentType == TYPE_PREVIEW || customPaint || drawFullBottom) {
                    path.lineTo(bounds.right - dp(8), bounds.bottom - padding - smallRad - dp(3));
                    rect.set(bounds.right - dp(8), bounds.bottom - padding - smallRad * 2 - dp(9), bounds.right - dp(7) + smallRad * 2, bounds.bottom - padding - dp(1));
                    path.arcTo(rect, 180, -83, false);
                } else {
                    path.lineTo(bounds.right - dp(8), top - topY + currentBackgroundHeight);
                }
            }
        } else {
            if (drawFullBubble || currentType == TYPE_PREVIEW || customPaint || drawFullBottom) {
                int radToUse = botButtonsBottom ? nearRad : rad;

                if (currentType == TYPE_MEDIA) {
                    path.moveTo(bounds.left + dp(8) + radToUse, bounds.bottom - padding);
                } else {
                    path.moveTo(bounds.left + dp(2.6f), bounds.bottom - padding);
                }
                path.lineTo(bounds.right - padding - radToUse, bounds.bottom - padding);
                rect.set(bounds.right - padding - radToUse * 2, bounds.bottom - padding - radToUse * 2, bounds.right - padding, bounds.bottom - padding);
                path.arcTo(rect, 90, -90, false);
            } else {
                path.moveTo(bounds.left + dp(8), top - topY + currentBackgroundHeight);
                path.lineTo(bounds.right - padding, top - topY + currentBackgroundHeight);
            }
            if (drawFullBubble || currentType == TYPE_PREVIEW || customPaint || drawFullTop) {
                path.lineTo(bounds.right - padding, bounds.top + padding + rad);
                rect.set(bounds.right - padding - rad * 2, bounds.top + padding, bounds.right - padding, bounds.top + padding + rad * 2);
                path.arcTo(rect, 0, -90, false);

                int radToUse = isTopNear ? nearRad : rad;
                if (currentType == TYPE_MEDIA) {
                    path.lineTo(bounds.left + padding + radToUse, bounds.top + padding);
                    rect.set(bounds.left + padding, bounds.top + padding, bounds.left + padding + radToUse * 2, bounds.top + padding + radToUse * 2);
                } else {
                    path.lineTo(bounds.left + dp(8) + radToUse, bounds.top + padding);
                    rect.set(bounds.left + dp(8), bounds.top + padding, bounds.left + dp(8) + radToUse * 2, bounds.top + padding + radToUse * 2);
                }
                path.arcTo(rect, 270, -90, false);
            } else {
                path.lineTo(bounds.right - padding, top - topY - dp(2));
                if (currentType == TYPE_MEDIA) {
                    path.lineTo(bounds.left + padding, top - topY - dp(2));
                } else {
                    path.lineTo(bounds.left + dp(8), top - topY - dp(2));
                }
            }
            if (currentType == TYPE_MEDIA) {
                if (customPaint || drawFullBottom) {
                    int radToUse = isBottomNear || botButtonsBottom ? nearRad : rad;

                    path.lineTo(bounds.left + padding, bounds.bottom - padding - radToUse);
                    rect.set(bounds.left + padding, bounds.bottom - padding - radToUse * 2, bounds.left + padding + radToUse * 2, bounds.bottom - padding);
                    path.arcTo(rect, 180, -90, false);
                } else {
                    path.lineTo(bounds.left + padding, top - topY + currentBackgroundHeight);
                }
            } else {
                if (drawFullBubble || currentType == TYPE_PREVIEW || customPaint || drawFullBottom) {
                    path.lineTo(bounds.left + dp(8), bounds.bottom - padding - smallRad - dp(3));
                    rect.set(bounds.left + dp(7) - smallRad * 2, bounds.bottom - padding - smallRad * 2 - dp(9), bounds.left + dp(8), bounds.bottom - padding - dp(1));
                    path.arcTo(rect, 0, 83, false);
                } else {
                    path.lineTo(bounds.left + dp(8), top - topY + currentBackgroundHeight);
                }
            }
        }
        path.close();
    }

}
