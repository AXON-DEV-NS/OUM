import numpy as np

# Mobile 1080x1350 figure boxes:
desk_xmin, desk_xmax = 398.0, 743.0
desk_ymin, desk_ymax = 576.1, 984.4

sofa_xmin, sofa_xmax = 420.8, 910.4
sofa_ymin, sofa_ymax = 1023.6, 1268.4

def dist_box(cx, cy, xmin, xmax, ymin, ymax):
    dx = max(0, max(xmin - cx, cx - xmax))
    dy = max(0, max(ymin - cy, cy - ymax))
    min_d = np.hypot(dx, dy)
    corners = [(xmin, ymin), (xmax, ymin), (xmin, ymax), (xmax, ymax)]
    max_d = max(np.hypot(x - cx, y - cy) for x, y in corners)
    return min_d, max_d

feather = 25.0

# Logo center on mobile: (540, 160)
cx, cy = 540.0, 160.0
d_min, d_max = dist_box(cx, cy, desk_xmin, desk_xmax, desk_ymin, desk_ymax)
s_min, s_max = dist_box(cx, cy, sofa_xmin, sofa_xmax, sofa_ymin, sofa_ymax)

inter = max(0, min(d_max, s_max) - max(d_min, s_min))
span_d = d_max - d_min
span_s = s_max - s_min
overlap_pct = (inter / min(span_d, span_s)) * 100

r0 = min(d_min, s_min) - feather
r1 = max(d_max, s_max) + feather

print(f"Mobile Wipe Center: ({cx}, {cy})")
print(f"Desk Radial Range: [{d_min:.1f}, {d_max:.1f}] px (span {span_d:.1f} px)")
print(f"Sofa Radial Range: [{s_min:.1f}, {s_max:.1f}] px (span {span_s:.1f} px)")
print(f"Overlap: {inter:.1f} px ({overlap_pct:.1f}%)")
print(f"R0: {r0:.1f} px, R1: {r1:.1f} px, Feather: {feather:.1f} px")

# Test frames with Remotion's standard ease-in-out:
# Remotion interpolate / cubic ease
# let's test frame by frame:
def ease_prog(frame, start, dur):
    t = max(0.0, min(1.0, (frame - start) / dur))
    # cubic-bezier(0.42, 0, 0.58, 1) standard easeInOut
    # or smoothstep 3t^2 - 2t^3
    return t * t * (3 - 2 * t)

first_desk_erase = None
first_sofa_reveal = None
frames_crossing = 0

for f in range(36):
    prog = ease_prog(f, 0, 35)
    r = r0 + (r1 - r0) * prog
    
    # Desk begins to erase when inner circle edge reaches d_min: r + feather >= d_min
    if r + feather >= d_min and first_desk_erase is None:
        first_desk_erase = f
    
    # Sofa is revealed when inner circle reaches s_min: r + feather >= s_min
    if r + feather >= s_min and first_sofa_reveal is None:
        first_sofa_reveal = f
        
    # Edge crosses bounding box:
    # desk: [r - feather, r + feather] overlaps [d_min, d_max]
    cross_d = (r + feather >= d_min) and (r - feather <= d_max)
    cross_s = (r + feather >= s_min) and (r - feather <= s_max)
    if cross_d or cross_s:
        frames_crossing += 1

print(f"First frame desk begins erase: f{first_desk_erase}")
print(f"First frame sofa is revealed: f{first_sofa_reveal}")
print(f"Frames crossing bounding boxes: {frames_crossing} / 36")
