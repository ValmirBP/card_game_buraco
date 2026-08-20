"""
Gera o ícone do Buraco Jogatina: um leque de 3 cartas sobre o feltro verde.

Desenha em 8x e reduz com LANCZOS (antialias caseiro), porque o desenho é
feito com primitivas do PIL, que não têm suavização própria - sem isso as
bordas das cartas e o coração ficam serrilhados nos tamanhos pequenos.

Duas variantes:
  - foreground: fundo TRANSPARENTE, arte dentro da zona segura do ícone
    adaptativo (o launcher pode mascarar/ampliar; só o centro ~66% é
    garantido).
  - legacy: fundo verde arredondado + arte, pros ícones antigos
    (ic_launcher / ic_launcher_round).
"""
from PIL import Image, ImageDraw

SS = 8  # supersampling

FELT = (15, 81, 50, 255)        # #0f5132
FELT_DARK = (10, 46, 30, 255)   # #0a2e1e
CREAM = (246, 239, 216, 255)    # #f6efd8
INK = (51, 51, 58, 255)         # #33333a
RED = (179, 37, 63, 255)        # #b3253f
GOLD = (212, 175, 55, 255)      # #d4af37


def _heart(draw, cx, cy, w, h, color):
    r = w / 4
    draw.ellipse([cx - w / 2, cy - h / 2, cx - w / 2 + 2 * r, cy - h / 2 + 2 * r], fill=color)
    draw.ellipse([cx + w / 2 - 2 * r, cy - h / 2, cx + w / 2, cy - h / 2 + 2 * r], fill=color)
    draw.polygon(
        [(cx - w / 2, cy - h / 2 + r), (cx + w / 2, cy - h / 2 + r), (cx, cy + h / 2)],
        fill=color,
    )


def _spade(draw, cx, cy, w, h, color):
    r = w / 4
    draw.polygon([(cx, cy - h / 2), (cx - w / 2, cy + h / 6), (cx + w / 2, cy + h / 6)], fill=color)
    draw.ellipse([cx - w / 2, cy + h / 6 - 2 * r, cx - w / 2 + 2 * r, cy + h / 6], fill=color)
    draw.ellipse([cx + w / 2 - 2 * r, cy + h / 6 - 2 * r, cx + w / 2, cy + h / 6], fill=color)
    draw.polygon(
        [(cx - w * 0.16, cy + h / 2), (cx + w * 0.16, cy + h / 2), (cx + w * 0.06, cy + h / 8), (cx - w * 0.06, cy + h / 8)],
        fill=color,
    )


def _diamond(draw, cx, cy, w, h, color):
    draw.polygon([(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)], fill=color)


def _card(size, angle, pip=None):
    """Uma carta creme com borda, já rotacionada (canvas transparente)."""
    w, h = int(size * 0.42), int(size * 0.60)
    pad = int(size * 0.10)
    layer = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = int(size * 0.05)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=r, fill=CREAM,
                        outline=INK, width=max(1, int(size * 0.012)))
    if pip == 'heart':
        _heart(d, pad + w / 2, pad + h * 0.52, w * 0.52, h * 0.42, RED)
    elif pip == 'diamond':
        _diamond(d, pad + w * 0.66, pad + h * 0.34, w * 0.34, h * 0.30, RED)
    elif pip == 'spade':
        _spade(d, pad + w * 0.34, pad + h * 0.34, w * 0.40, h * 0.34, INK)
    return layer.rotate(angle, resample=Image.BICUBIC, expand=True)


def _fan(canvas, size, cx, cy):
    """Cola o leque de 3 cartas centrado em (cx, cy)."""
    spread = size * 0.26
    for angle, dx, pip in ((20, -spread, 'spade'), (-20, spread, 'diamond'), (0, 0, 'heart')):
        card = _card(size, angle, pip)
        canvas.alpha_composite(card, (int(cx + dx - card.width / 2), int(cy - card.height / 2)))


def foreground(px):
    """Ícone adaptativo: arte na zona segura, fundo transparente."""
    size = px * SS
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # zona segura do adaptive icon: conteúdo no centro; 0.52 deixa margem
    # confortável pro recorte circular/squircle de qualquer launcher.
    _fan(img, size * 0.52, size / 2, size / 2)
    return img.resize((px, px), Image.LANCZOS)


def legacy(px, round_icon=False):
    """Ícone antigo: fundo verde próprio + leque maior."""
    size = px * SS
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_icon:
        d.ellipse([0, 0, size - 1, size - 1], fill=FELT)
        d.ellipse([size * 0.03, size * 0.03, size * 0.97, size * 0.97],
                  outline=GOLD, width=max(1, int(size * 0.018)))
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=FELT)
        d.rounded_rectangle([size * 0.035, size * 0.035, size * 0.965, size * 0.965],
                            radius=int(size * 0.19), outline=GOLD, width=max(1, int(size * 0.018)))
    _fan(img, size * 0.62, size / 2, size / 2)
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
    # Prévia grande pro usuário conferir
    legacy(512).save(f'{base}/../../../../../icon-preview.png')
    print('ok')
