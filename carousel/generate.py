from PIL import Image, ImageDraw, ImageFont
import os

# Colors
NAVY = (28, 59, 106)
WHITE = (255, 255, 255)
WHITE_50 = (255, 255, 255, 128)
WHITE_10 = (255, 255, 255, 26)
WHITE_08 = (255, 255, 255, 20)

SIZE = (1080, 1080)

def get_font(size, bold=False):
    """Try to load a font, fallback to default"""
    font_paths = [
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'Bold' if bold else ''}.ttf",
        f"/usr/share/fonts/truetype/liberation/LiberationSans-{'Bold' if bold else 'Regular'}.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def draw_chevron(draw, x_offset, y_center, size=400, color=(255,255,255,25), two=True):
    """Draw one or two right-pointing chevrons"""
    h = size
    w = size * 0.55
    tip = size * 0.45

    def chevron(ox):
        points = [
            (ox, y_center - h//2),
            (ox + w*0.6, y_center - h//2),
            (ox + w*0.6 + tip, y_center),
            (ox + w*0.6, y_center + h//2),
            (ox, y_center + h//2),
            (ox + tip, y_center),
        ]
        return [(int(p[0]), int(p[1])) for p in points]

    overlay = Image.new('RGBA', SIZE, (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.polygon(chevron(x_offset), fill=color)
    if two:
        od.polygon(chevron(x_offset + int(w * 0.75)), fill=color)
    return overlay

def draw_text_centered(draw, text, y, font, color=WHITE, img_width=1080):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    x = (img_width - w) // 2
    draw.text((x, y), text, font=font, fill=color)

def draw_text_right(draw, text, y, font, color=WHITE, margin=90, img_width=1080):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    x = img_width - margin - w
    draw.text((x, y), text, font=font, fill=color)

# ─────────────────────────────────────────────
# SLIDE 1 — Hook 80%
# ─────────────────────────────────────────────
def slide1():
    img = Image.new('RGB', SIZE, NAVY)

    chev = draw_chevron(None, 750, 540, size=900, color=(255,255,255,18))
    img.paste(Image.alpha_composite(Image.new('RGBA', SIZE, (0,0,0,0)), chev), mask=chev.split()[3])

    draw = ImageDraw.Draw(img)

    # Tag
    f_tag = get_font(28)
    draw.text((100, 200), "LE SAVIEZ-VOUS ?", font=f_tag, fill=(255,255,255,100))

    # 80%
    f_big = get_font(240, bold=True)
    draw.text((85, 260), "80%", font=f_big, fill=WHITE)

    # subtitle
    f_sub = get_font(48)
    draw.text((100, 680), "des cuisines qu'on vend", font=f_sub, fill=(255,255,255,210))
    draw.text((100, 740), "sont en", font=f_sub, fill=(255,255,255,210))

    # highlight
    f_hl = get_font(80, bold=True)
    draw.text((100, 810), "STRATIFIÉ", font=f_hl, fill=WHITE)

    # Logo
    f_logo = get_font(38, bold=True)
    draw_text_right(draw, "ixina", 990, f_logo, color=(255,255,255,170))

    img.save("slide1.png")
    print("✓ slide1.png")

# ─────────────────────────────────────────────
# SLIDE 2 — Raison 1 : Ça claque
# ─────────────────────────────────────────────
def slide2():
    img = Image.new('RGB', SIZE, NAVY)

    chev = draw_chevron(None, 800, 750, size=700, color=(255,255,255,15))
    img.paste(Image.alpha_composite(Image.new('RGBA', SIZE, (0,0,0,0)), chev), mask=chev.split()[3])

    draw = ImageDraw.Draw(img)

    # Big number background
    f_num = get_font(220, bold=True)
    draw.text((70, 50), "01", font=f_num, fill=(255,255,255,18))

    # Label
    f_tag = get_font(26)
    draw.text((100, 340), "RAISON N°1", font=f_tag, fill=(255,255,255,110))

    # Title
    f_title = get_font(120, bold=True)
    draw.text((100, 390), "ÇA CLAQUE.", font=f_title, fill=WHITE)

    # Divider
    draw.rectangle([100, 570, 180, 577], fill=(255,255,255,150))

    # Description
    f_desc = get_font(46)
    draw.text((100, 610), "L'effet est texturé,", font=f_desc, fill=(255,255,255,210))
    f_desc_bold = get_font(46, bold=True)
    draw.text((100, 670), "c'est nickel.", font=f_desc_bold, fill=WHITE)
    draw.text((100, 745), "Un rendu qui en met plein les yeux.", font=f_desc, fill=(255,255,255,190))

    # Logo
    f_logo = get_font(38, bold=True)
    draw_text_right(draw, "ixina", 990, f_logo, color=(255,255,255,170))

    img.save("slide2.png")
    print("✓ slide2.png")

# ─────────────────────────────────────────────
# SLIDE 3 — Raison 2 : Facile à travailler
# ─────────────────────────────────────────────
def slide3():
    img = Image.new('RGB', SIZE, NAVY)

    # Left-pointing chevron (reversed)
    overlay = Image.new('RGBA', SIZE, (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    h, tip = 900, 200
    def lchev(ox):
        return [(ox+tip,540-h//2),(ox+tip*2,540-h//2),(ox,540),(ox+tip*2,540+h//2),(ox+tip,540+h//2),(ox+tip*2+tip,540)]
    # simple left chevron
    pts1 = [(-80,90),(130,90),(-80+230,540),(130,990),(-80,990),(130-230,540)]
    pts2 = [(130,90),(340,90),(130+230,540),(340,990),(130,990),(340-230,540)]
    od.polygon(pts1, fill=(255,255,255,15))
    od.polygon(pts2, fill=(255,255,255,15))
    img.paste(Image.alpha_composite(Image.new('RGBA', SIZE, (0,0,0,0)), overlay), mask=overlay.split()[3])

    draw = ImageDraw.Draw(img)

    # Big number background
    f_num = get_font(220, bold=True)
    draw_text_right(draw, "02", 50, f_num, color=(255,255,255,18))

    # Label
    f_tag = get_font(26)
    draw_text_right(draw, "RAISON N°2", 340, f_tag, color=(255,255,255,110))

    # Title
    f_title = get_font(100, bold=True)
    draw_text_right(draw, "FACILE À", 395, f_title, color=WHITE)
    draw_text_right(draw, "TRAVAILLER.", 505, f_title, color=WHITE)

    # Divider
    draw.rectangle([900, 640, 980, 647], fill=(255,255,255,150))

    # Description
    f_desc = get_font(40)
    f_bold = get_font(40, bold=True)
    draw_text_right(draw, "Le placeur fait ses découpes sur place", 680, f_desc, color=(255,255,255,200))
    draw_text_right(draw, "et ajuste les plans de travail", 730, f_desc, color=(255,255,255,200))
    draw_text_right(draw, "et crédences au mieux.", 780, f_bold, color=WHITE)

    # Logo
    f_logo = get_font(38, bold=True)
    draw.text((90, 990), "ixina", font=f_logo, fill=(255,255,255,170))

    img.save("slide3.png")
    print("✓ slide3.png")

# ─────────────────────────────────────────────
# SLIDE 4 — Raison 3 : Qualité-prix
# ─────────────────────────────────────────────
def slide4():
    img = Image.new('RGB', SIZE, NAVY)

    # Pattern background: small X shapes
    overlay = Image.new('RGBA', SIZE, (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    step = 90
    for row in range(0, 1080 + step, step):
        for col in range(0, 1080 + step, step):
            s = 28
            # small chevron outline
            od.polygon([(col,row),(col+s*0.6,row),(col+s,row+s*0.5),(col+s*0.6,row+s),(col,row+s),(col+s*0.4,row+s*0.5)],
                       outline=(255,255,255,30), fill=None)
    img.paste(Image.alpha_composite(Image.new('RGBA', SIZE, (0,0,0,0)), overlay), mask=overlay.split()[3])

    draw = ImageDraw.Draw(img)

    # Big number background
    f_num = get_font(220, bold=True)
    draw.text((70, 50), "03", font=f_num, fill=(255,255,255,18))

    # Label
    f_tag = get_font(26)
    draw.text((100, 340), "RAISON N°3", font=f_tag, fill=(255,255,255,110))

    # Title
    f_title = get_font(100, bold=True)
    draw.text((100, 390), "BON RAPPORT", font=f_title, fill=WHITE)
    draw.text((100, 500), "QUALITÉ-PRIX.", font=f_title, fill=WHITE)

    # Divider
    draw.rectangle([100, 640, 180, 647], fill=(255,255,255,150))

    # Description
    f_desc = get_font(42)
    f_bold = get_font(42, bold=True)
    draw.text((100, 680), "Un matériel plaisant pour votre cuisine", font=f_desc, fill=(255,255,255,200))
    draw.text((100, 735), "qui ne coûte pas très cher.", font=f_bold, fill=WHITE)
    draw.text((100, 810), "C'est le nerf de la guerre.", font=f_desc, fill=(255,255,255,180))

    # Logo
    f_logo = get_font(38, bold=True)
    draw_text_right(draw, "ixina", 990, f_logo, color=(255,255,255,170))

    img.save("slide4.png")
    print("✓ slide4.png")

# ─────────────────────────────────────────────
# SLIDE 5 — CTA Final
# ─────────────────────────────────────────────
def slide5():
    img = Image.new('RGB', SIZE, NAVY)

    chev = draw_chevron(None, 700, 540, size=1000, color=(255,255,255,20))
    img.paste(Image.alpha_composite(Image.new('RGBA', SIZE, (0,0,0,0)), chev), mask=chev.split()[3])

    draw = ImageDraw.Draw(img)

    # ixina big
    f_logo_big = get_font(110, bold=True)
    draw.text((100, 200), "ixina", font=f_logo_big, fill=WHITE)

    # Divider
    draw.rectangle([100, 350, 200, 358], fill=(255,255,255,130))

    # Tagline
    f_tag = get_font(50)
    f_bold = get_font(50, bold=True)
    draw.text((100, 390), "Votre cuisine en stratifié :", font=f_tag, fill=(255,255,255,200))
    draw.text((100, 460), "belle, pratique", font=f_bold, fill=WHITE)
    draw.text((100, 525), "& accessible.", font=f_bold, fill=WHITE)

    # CTA
    f_cta = get_font(30)
    draw.text((100, 650), "VENEZ DÉCOUVRIR NOS MODÈLES  →", font=f_cta, fill=(255,255,255,130))

    # Belgium
    f_be = get_font(22)
    draw.text((100, 1030), "BELGIQUE", font=f_be, fill=(255,255,255,80))

    img.save("slide5.png")
    print("✓ slide5.png")

# Run all
os.chdir("/home/user/Eee/carousel")
slide1()
slide2()
slide3()
slide4()
slide5()
print("\nDone! 5 slides generated.")
