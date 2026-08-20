"""
Gera o ícone do Buraco Jogatina: um leque de cartas J Q K A sobre o
feltro verde.

Desenha em 8x e reduz com LANCZOS (antialias caseiro), porque as primitivas
do PIL não têm suavização própria - sem isso as bordas das cartas e os
naipes ficam serrilhados nos tamanhos pequenos.

Duas variantes, como o Android espera:
  - foreground: fundo TRANSPARENTE, arte dentro da zona segura do ícone
    adaptativo (o launcher mascara/amplia; só o centro é garantido).
  - legacy: fundo verde próprio, pros ic_launcher / ic_launcher_round
    antigos.

Rodar:  python3 docs/gerar-icone.py android/app/src/main/res
"""
from PIL import Image, ImageDraw, ImageFont

SS = 8  # supersampling

FELT = (15, 81, 50, 255)        # #0f5132
CREAM = (246, 239, 216, 255)    # #f6efd8
INK = (51, 51, 58, 255)         # #33333a
RED = (179, 37, 63, 255)        # #b3253f
GOLD = (212, 175, 55, 255)      # #d4af37
WHITE = (253, 250, 242, 255)

FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

# Cartas do leque, da esquerda pra direita: rank, naipe, ângulo, deslocamento
# horizontal (fração do tamanho) e vertical (o leque faz um arco raso).
FAN = [
    ('J', 'hearts', 22, -0.26, 0.040),
    ('Q', 'spades', 7, -0.10, -0.008),
    ('K', 'diamonds', -7, 0.06, -0.008),
    ('A', 'clubs', -22, 0.22, 0.040),
]


def _suit(draw, kind, cx, cy, w, h, color):
    """Naipe pequeno, desenhado (não é fonte: os glifos ♥♦♣♠ variam demais
    entre sistemas e alguns caem em emoji colorido)."""
    if kind == 'hearts':
        r = w / 4
        draw.ellipse([cx - w / 2, cy - h / 2, cx - w / 2 + 2 * r, cy - h / 2 + 2 * r], fill=color)
        draw.ellipse([cx + w / 2 - 2 * r, cy - h / 2, cx + w / 2, cy - h / 2 + 2 * r], fill=color)
        draw.polygon([(cx - w / 2, cy - h / 2 + r), (cx + w / 2, cy - h / 2 + r), (cx, cy + h / 2)], fill=color)
    elif kind == 'diamonds':
        draw.polygon([(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)], fill=color)
    elif kind == 'clubs':
        # Três lóbulos com centros explícitos e raio menor que a distância
        # entre eles: assim eles se tocam mas continuam distinguíveis. Com o
        # raio antigo (w/3.4) os círculos se sobrepunham quase todos e o
        # naipe virava um borrão redondo nos tamanhos pequenos.
        r = w * 0.27
        for lx, ly in ((cx, cy - h * 0.20), (cx - w * 0.25, cy + h * 0.08), (cx + w * 0.25, cy + h * 0.08)):
            draw.ellipse([lx - r, ly - r, lx + r, ly + r], fill=color)
        draw.polygon([(cx - w * 0.17, cy + h / 2), (cx + w * 0.17, cy + h / 2),
                      (cx + w * 0.06, cy + h * 0.05), (cx - w * 0.06, cy + h * 0.05)], fill=color)
    elif kind == 'spades':
        # Espada = coração de cabeça pra baixo + cabo. As duas bolhas ficam
        # CENTRADAS em cx ± w/4 (raio w/4), então a borda externa delas cai
        # exatamente em cx ± w/2 e o contorno fecha com a base do triângulo.
        # Antes as elipses eram ancoradas na borda e ficavam largas demais,
        # dando um formato de cogumelo em vez de espada.
        r = w / 4
        base = cy + h * 0.10
        draw.polygon([(cx, cy - h / 2), (cx - w / 2, base), (cx + w / 2, base)], fill=color)
        draw.ellipse([cx - w / 2, base - r, cx, base + r], fill=color)
        draw.ellipse([cx, base - r, cx + w / 2, base + r], fill=color)
        draw.polygon([(cx - w * 0.16, cy + h / 2), (cx + w * 0.16, cy + h / 2),
                      (cx + w * 0.05, base + r * 0.2), (cx - w * 0.05, base + r * 0.2)], fill=color)


def _card(size, rank, suit, angle):
    """Uma carta do leque: rank + naipe no canto superior esquerdo."""
    w, h = int(size * 0.30), int(size * 0.44)
    pad = int(size * 0.09)
    layer = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=int(size * 0.028),
                        fill=CREAM, outline=INK, width=max(1, int(size * 0.008)))
    color = RED if suit in ('hearts', 'diamonds') else INK
    fs = int(h * 0.34)
    try:
        font = ImageFont.truetype(FONT_BOLD, fs)
    except OSError:
        font = ImageFont.load_default()
    # anchor 'mm' (centro do glifo) em vez de 'ma' (linha ASCENDENTE): a
    # ascendente fica acima da altura das maiúsculas e varia por fonte, então
    # o topo do J, do K e do A passava da borda da carta e era cortado (o Q
    # escapava só por ser arredondado). Com o centro é previsível: basta
    # colocá-lo a 22% da altura pra letra caber inteira.
    d.text((pad + w * 0.26, pad + h * 0.22), rank, font=font, fill=color, anchor='mm')
    _suit(d, suit, pad + w * 0.26, pad + h * 0.60, w * 0.40, h * 0.28, color)
    return layer.rotate(angle, resample=Image.BICUBIC, expand=True)


def _joker(size):
    """Curinga espiando por cima do leque: chapéu de 3 pontas com guizos."""
    s = int(size * 0.34)
    layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # chapéu
    d.polygon([(s * 0.14, s * 0.62), (s * 0.20, s * 0.20), (s * 0.36, s * 0.46),
               (s * 0.50, s * 0.12), (s * 0.64, s * 0.46), (s * 0.80, s * 0.20),
               (s * 0.86, s * 0.62)], fill=GOLD)
    r = s * 0.075
    for cx, cy in ((s * 0.20, s * 0.20), (s * 0.50, s * 0.12), (s * 0.80, s * 0.20)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    # rosto
    d.ellipse([s * 0.16, s * 0.54, s * 0.84, s * 0.98], fill=WHITE)
    er = s * 0.048
    for cx in (s * 0.38, s * 0.62):
        d.ellipse([cx - er, s * 0.70 - er, cx + er, s * 0.70 + er], fill=INK)
    d.arc([s * 0.38, s * 0.76, s * 0.62, s * 0.88], start=15, end=165, fill=INK, width=max(1, int(s * 0.038)))
    return layer.rotate(14, resample=Image.BICUBIC, expand=True)


def _art(canvas, size, cx, cy):
    """Leque de cartas, centrado em (cx, cy). Sem figura de curinga: o
    bonequinho deixava o icone com cara infantil."""
    for rank, suit, angle, dx, dy in FAN:
        card = _card(size, rank, suit, angle)
        canvas.alpha_composite(card, (int(cx + dx * size - card.width / 2),
                                      int(cy + dy * size - card.height / 2)))


def foreground(px):
    size = px * SS
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # zona segura do ícone adaptativo: a arte fica no centro, com folga pro
    # recorte circular/squircle de qualquer launcher.
    _art(img, size * 0.62, size * 0.50, size * 0.50)
    return img.resize((px, px), Image.LANCZOS)


def legacy(px, round_icon=False):
    size = px * SS
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_icon:
        d.ellipse([0, 0, size - 1, size - 1], fill=FELT)
        d.ellipse([size * 0.03, size * 0.03, size * 0.97, size * 0.97],
                  outline=GOLD, width=max(1, int(size * 0.016)))
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=FELT)
        d.rounded_rectangle([size * 0.035, size * 0.035, size * 0.965, size * 0.965],
                            radius=int(size * 0.19), outline=GOLD, width=max(1, int(size * 0.016)))
    _art(img, size * 0.76, size * 0.50, size * 0.50)
    return img.resize((px, px), Image.LANCZOS)


if __name__ == '__main__':
    import sys
    base = sys.argv[1]
    fg = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    lg = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for dens, px in fg.items():
        foreground(px).save(f'{base}/mipmap-{dens}/ic_launcher_foreground.png')
    for dens, px in lg.items():
        legacy(px).save(f'{base}/mipmap-{dens}/ic_launcher.png')
        legacy(px, True).save(f'{base}/mipmap-{dens}/ic_launcher_round.png')
    legacy(512).save(f'{base}/../../../../../icon-preview.png')
    print('ok')
