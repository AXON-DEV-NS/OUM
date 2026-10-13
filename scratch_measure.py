from PIL import Image
import numpy as np

for name, vp_w, vp_h in [('1920.png', 1920, 1080), ('1366.png', 1366, 768)]:
    im = Image.open('video/out/baseline4/' + name).convert('RGB')
    arr = np.array(im)
    bg = arr[0, 0]
    diff = np.abs(arr.astype(int) - bg.astype(int)).max(axis=-1)
    
    # Hero text is located between y=100 and y=vp_h-100, and x < vp_w * 0.7
    # Let's inspect rows y in [150, 700]
    hero_diff = diff[100:min(vp_h, 700), 50:int(vp_w * 0.65)]
    ys, xs = np.where(hero_diff > 25)
    real_xs = xs + 50
    real_ys = ys + 100
    print(f'{name} ({vp_w}x{vp_h}):')
    print(f'  Hero Text X range: {real_xs.min()} to {real_xs.max()} (right edge = {real_xs.max()})')
    print(f'  Hero Text Y range: {real_ys.min()} to {real_ys.max()}')
