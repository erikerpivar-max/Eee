from PIL import Image, ImageDraw, ImageFont
import os

NAVY = (28, 59, 106)
NAVY_DARK = (18, 38, 72)
WHITE = (255, 255, 255)
DARK = (18, 38, 72)
LIGHT_TEXT = (255, 255, 255, 180)
SIZE = (1080, 1080)

def get_font(size, bold=False):
    paths = [
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'Bold' if bold else ''}.ttf",
        f"/usr/share/fonts/truetype/liberation/LiberationSans-{'Bold' if bold else 'Regular'}.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def text_width(draw, text, font):
    bb = draw.textbbox((0,0), text, font=font)
    return bb[2] - bb[0], bb[3] - bb[1]

def white_pill(draw, text, cx, y, font, px=44, py=20, r=16, align='center'):
    """Draw a white pill/banner with dark text, centered at cx"""
    tw, th = text_width(draw, text, font)
    w = tw + px*2
    h = th + py*2
    if align == 'center':
        x1 = cx - w//2
    else:
        x1 = cx
    y1 = y
    draw.rounded_rectangle([x1, y1, x1+w, y1+h], radius=r, fill=WHITE)
    draw.text((x1+px, y1+py), text, font=font, fill=DARK)
    return h

def white_card(draw, img, x, y, w, h, r=24):
    """Draw a white rounded card"""
    # Use overlay for slight transparency
    overlay = Image.new('RGBA', SIZE, (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([x, y, x+w, y+h], radius=r, fill=(255,255,255,240))
    img.paste(Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB'), (0,0))

def slide_counter(draw, current, total, font):
    """Draw slide counter badge in top right"""
    text = f"{current}/{total}"
    tw, th = text_width(draw, text, font)
    pad = 18
    r = (th + pad*2) // 2
    x1 = SIZE[0] - tw - pad*2 - 60
    y1 = 55
    draw.rounded_rectangle([x1, y1, x1+tw+pad*2, y1+th+pad*2], radius=r, fill=(28,70,120))
    draw.text((x1+pad, y1+pad), text, font=font, fill=WHITE)

def ixina_logo(draw, x, y, size=38):
    f = get_font(size, bold=True)
    draw.text((x, y), "ixina", font=f, fill=(255,255,255,160))


# ─────────────────────────────────────────────
# SLIDE 1 — Hook
# ─────────────────────────────────────────────
def slide1():
    img = Image.new('RGB', SIZE, NAVY)
    draw = ImageDraw.Draw(img)

    # Slide counter
    slide_counter(draw, 1, 5, get_font(30, bold=True))

    # Big "80%"
    f_huge = get_font(280, bold=True)
    draw.text((72, 160), "80%", font=f_huge, fill=WHITE)

    # Subtitle
    f_sub = get_font(46)
    draw.text((80, 580), "des cuisines qu'on vend", font=f_sub, fill=(255,255,255,200))
    draw.text((80, 640), "sont en", font=f_sub, fill=(255,255,255,200))

    # White pill: STRATIFIÉ
    f_hl = get_font(72, bold=True)
    white_pill(draw, "STRATIFIÉ", 540, 720, f_hl, px=50, py=22, r=18, align='center')

    # Swipe
    f_swipe = get_font(30)
    draw.text((390, 960), "swipe  →", font=f_swipe, fill=(255,255,255,110))

    # Logo
    ixina_logo(draw, 60, 1000)

    img.save("slide1.png")
    print("✓ slide1.png")

# ─────────────────────────────────────────────
# SLIDE 2 — Raison 1
# ─────────────────────────────────────────────
def slide2():
    img = Image.new('RGB', SIZE, NAVY)
    draw = ImageDraw.Draw(img)

    slide_counter(draw, 2, 5, get_font(30, bold=True))

    # White pill title
    f_title = get_font(58, bold=True)
    pill_h = white_pill(draw, "#1  ÇA CLAQUE.", 540, 130, f_title, px=50, py=22, r=18, align='center')

    # Subtitle
    f_sub = get_font(38)
    draw.text((80, 130+pill_h+40), "L'effet texturé fait toute la différence.", font=f_sub, fill=(255,255,255,200))

    # White card
    card_y = 380
    card_h = 420
    card_x = 70
    card_w = SIZE[0] - card_x*2
    img_rgba = img.convert('RGBA')
    overlay = Image.new('RGBA', SIZE, (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([card_x, card_y, card_x+card_w, card_y+card_h], radius=28, fill=(255,255,255,230))
    img = Image.alpha_composite(img_rgba, overlay).convert('RGB')
    draw = ImageDraw.Draw(img)

    # Card content
    f_bold = get_font(40, bold=True)
    f_reg = get_font(36)
    items = [
        ("✓  Effet texturé et chaleureux", True),
        ("✓  Rendu haut de gamme", True),
        ("✓  Joli dès le premier coup d'œil", True),
        ("    Un matériau qui habille votre cuisine.", False),
    ]
    for i, (text, bold) in enumerate(items):
        f = f_bold if bold else f_reg
        color = DARK if bold else (40,60,100)
        draw.text((card_x+44, card_y+40+i*92), text, font=f, fill=color)

    ixina_logo(draw, 60, 1000)
    slide_counter(draw, 2, 5, get_font(30, bold=True))

    img.save("slide2.png")
    print("✓ slide2.png")

# ─────────────────────────────────────────────
# SLIDE 3 — Raison 2
# ─────────────────────────────────────────────
def slide3():
    img = Image.new('RGB', SIZE, NAVY)
    draw = ImageDraw.Draw(img)

    slide_counter(draw, 3, 5, get_font(30, bold=True))

    # White pill title
    f_title = get_font(52, bold=True)
    pill_h = white_pill(draw, "#2  FACILE À TRAVAILLER.", 540, 130, f_title, px=44, py=22, r=18, align='center')

    # Subtitle
    f_sub = get_font(38)
    draw.text((80, 130+pill_h+40), "Le placeur adapte tout sur place.", font=f_sub, fill=(255,255,255,200))

    # White card
    card_y = 370
    card_h = 460
    card_x = 70
    card_w = SIZE[0] - card_x*2
    img_rgba = img.convert('RGBA')
    overlay = Image.new('RGBA', SIZE, (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([card_x, card_y, card_x+card_w, card_y+card_h], radius=28, fill=(255,255,255,230))
    img = Image.alpha_composite(img_rgba, overlay).convert('RGB')
    draw = ImageDraw.Draw(img)

    f_bold = get_font(40, bold=True)
    f_reg = get_font(36)
    items = [
        ("✓  Découpes réalisées directement sur place", True),
        ("✓  Plans de travail ajustés au millimètre", True),
        ("✓  Crédences posées sans complication", True),
        ("    Moins de chantier, plus de précision.", False),
    ]
    for i, (text, bold) in enumerate(items):
        f = f_bold if bold else f_reg
        color = DARK if bold else (40,60,100)
        draw.text((card_x+44, card_y+40+i*98), text, font=f, fill=color)

    ixina_logo(draw, 60, 1000)
    slide_counter(draw, 3, 5, get_font(30, bold=True))

    img.save("slide3.png")
    print("✓ slide3.png")

# ─────────────────────────────────────────────
# SLIDE 4 — Raison 3
# ─────────────────────────────────────────────
def slide4():
    img = Image.new('RGB', SIZE, NAVY)
    draw = ImageDraw.Draw(img)

    slide_counter(draw, 4, 5, get_font(30, bold=True))

    # White pill title
    f_title = get_font(50, bold=True)
    pill_h = white_pill(draw, "#3  BON RAPPORT QUALITÉ-PRIX.", 540, 130, f_title, px=38, py=22, r=18, align='center')

    # Subtitle
    f_sub = get_font(38)
    draw.text((80, 130+pill_h+40), "Plaisant et accessible. Le nerf de la guerre.", font=f_sub, fill=(255,255,255,200))

    # Two mini cards
    card_y = 390
    card_h = 230
    card_x = 70
    card_w = SIZE[0] - card_x*2

    for ci, (title, body) in enumerate([
        ("Matériau plaisant", "Un rendu soigné pour votre cuisine\nsans exploser le budget."),
        ("Prix accessible", "Le stratifié reste le matériau\nle plus populaire en Belgique."),
    ]):
        cy = card_y + ci * (card_h + 30)
        img_rgba = img.convert('RGBA')
        overlay = Image.new('RGBA', SIZE, (0,0,0,0))
        od = ImageDraw.Draw(overlay)
        od.rounded_rectangle([card_x, cy, card_x+card_w, cy+card_h], radius=24, fill=(255,255,255,220))
        img = Image.alpha_composite(img_rgba, overlay).convert('RGB')
        draw = ImageDraw.Draw(img)
        f_bold = get_font(40, bold=True)
        f_reg = get_font(34)
        draw.text((card_x+44, cy+30), title, font=f_bold, fill=DARK)
        for li, line in enumerate(body.split('\n')):
            draw.text((card_x+44, cy+90+li*44), line, font=f_reg, fill=(40,60,100))

    ixina_logo(draw, 60, 1000)
    slide_counter(draw, 4, 5, get_font(30, bold=True))

    img.save("slide4.png")
    print("✓ slide4.png")

# ─────────────────────────────────────────────
# SLIDE 5 — CTA Final
# ─────────────────────────────────────────────
def slide5():
    img = Image.new('RGB', SIZE, NAVY)
    draw = ImageDraw.Draw(img)

    slide_counter(draw, 5, 5, get_font(30, bold=True))

    # ixina big logo
    f_logo = get_font(120, bold=True)
    draw.text((80, 140), "ixina", font=f_logo, fill=WHITE)

    # Divider line
    draw.rectangle([80, 300, 220, 308], fill=(255,255,255,120))

    # Summary white pill
    f_pill = get_font(38, bold=True)
    white_pill(draw, "Le stratifié en 3 mots :", 540, 370, f_pill, px=40, py=18, r=14, align='center')

    # 3 words as big text
    f_words = get_font(80, bold=True)
    draw.text((80, 470), "Beau.", font=f_words, fill=WHITE)
    draw.text((80, 570), "Pratique.", font=f_words, fill=WHITE)
    draw.text((80, 670), "Accessible.", font=f_words, fill=WHITE)

    # CTA
    f_cta = get_font(34)
    draw.text((80, 820), "Venez découvrir nos modèles en showroom.", font=f_cta, fill=(255,255,255,160))

    # Divider bottom
    draw.rectangle([80, 900, SIZE[0]-80, 902], fill=(255,255,255,40))
    f_be = get_font(26)
    draw.text((80, 920), "BELGIQUE", font=f_be, fill=(255,255,255,80))

    img.save("slide5.png")
    print("✓ slide5.png")


os.chdir("/home/user/Eee/carousel")
slide1()
slide2()
slide3()
slide4()
slide5()
print("\nDone!")
