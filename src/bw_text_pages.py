"""ocrmypdf plugin shipped with the Zotero DJVU to PDF Converter.

Adds --bw-text-pages. Before ocrmypdf's optimizer runs, every large image in
the PDF is classified from its pixels:

- text only (paper and ink, no pictures, no coloured ink): converted to
  black & white (1-bit, CCITT G4), which the optimizer then turns into JBIG2
  when jbig2enc is installed. Low-resolution scans are upscaled first so
  letter edges stay smooth.
- no colour content but not safely text-only (photos, shading): greyscale.
- anything with colour: left unchanged.

Images are replaced in place, so text layers, links and bookmarks are kept.
Detection is deliberately conservative: when in doubt, an image is left alone.
Uses only what ocrmypdf itself depends on (pikepdf, Pillow).
"""

from __future__ import annotations

import io
import logging
import zlib

import pikepdf
from PIL import Image, ImageChops, ImageFilter, ImageStat

from ocrmypdf import hookimpl
from ocrmypdf.builtin_plugins import optimize as builtin_optimize

log = logging.getLogger("ocrmypdf.bw_text_pages")

MIN_PIXELS = 1_000_000      # smaller images are icons/figures, not page scans
WORK_SIZE = 1600            # long side of the copy used for classification (px)
MIN_CONTRAST = 60           # ink must be at least this much darker than the paper
PAGE_MIDTONE_MAX = 0.08     # share of pixels between paper and ink, whole page
TILE_GRID = 16              # page is split into TILE_GRID x TILE_GRID tiles;
                            # the outer ring is ignored (scan edges, spines, tables)
TILE_MIDTONE_MAX = 0.25     # a tile this full of mid-tones looks like a picture
COLOUR_CHROMA = 70          # max-min channel spread of printed colour (shadows and
                            # tinted paper stay below it)
COLOUR_INK_MAX = 0.03       # share of coloured ink pixels allowed on the page
COLOUR_TILE_MAX = 0.20      # share of coloured ink that makes a tile coloured
MIN_FLAGGED_TILES = 2       # pictures/colour must span more than one tile
TARGET_DPI = 300            # scans below this are upscaled before thresholding
MAX_UPSCALE = 2


@hookimpl
def add_options(parser):
    group = parser.add_argument_group(
        "Black & white text pages", "Options added by the DJVU to PDF Converter plugin"
    )
    group.add_argument(
        "--bw-text-pages",
        action="store_true",
        help="Convert page scans that contain only text to black & white "
        "(colourless scans with pictures become greyscale)",
    )


@hookimpl
def optimize_pdf(input_pdf, output_pdf, context, executor, linearize):
    messages = []
    if getattr(context.options, "bw_text_pages", False):
        converted = output_pdf.with_name(output_pdf.stem + "_bw_text_pages.pdf")
        counts = convert_text_pages(input_pdf, converted)
        summary = (
            f"bw-text-pages: {counts['bw']} image(s) to black & white, "
            f"{counts['grey']} to greyscale, {counts['kept']} unchanged"
        )
        log.info(summary)
        messages.append(summary)
        input_pdf = converted
    result, builtin_messages = builtin_optimize.optimize_pdf(
        input_pdf, output_pdf, context, executor, linearize
    )
    return result, [*messages, *builtin_messages]


def convert_text_pages(input_pdf, output_pdf):
    counts = {"bw": 0, "grey": 0, "kept": 0}
    seen = set()
    with pikepdf.open(input_pdf) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            try:
                page_width_in = float(page.mediabox[2] - page.mediabox[0]) / 72
            except Exception:
                page_width_in = 0
            for raw in _page_images(page):
                if raw.objgen in seen:
                    continue
                seen.add(raw.objgen)
                try:
                    result, reason = _convert_image(raw, page_width_in)
                except Exception as e:  # never fail the whole run over one image
                    result, reason = "kept", f"error: {e}"
                log.debug("bw-text-pages: page %d image %s: %s (%s)", page_no, raw.objgen, result, reason)
                counts[result] += 1
        pdf.save(output_pdf)
    return counts


def _page_images(page):
    # get_images() also finds images inside form XObjects (newer pikepdf)
    getter = getattr(page, "get_images", None)
    images = getter() if getter else page.images
    return list(images.values())


def _convert_image(raw, page_width_in):
    if raw.get("/ImageMask", False) or "/SMask" in raw or "/Mask" in raw or "/Decode" in raw:
        return "kept", "mask or decode array"
    if int(raw.get("/BitsPerComponent", 8)) not in (2, 4, 8):
        return "kept", "already 1-bit or 16-bit"
    width, height = int(raw.Width), int(raw.Height)
    if width * height < MIN_PIXELS:
        return "kept", "small image"

    image = pikepdf.PdfImage(raw).as_pil_image()
    if image.mode not in ("L", "RGB", "P", "CMYK"):
        return "kept", f"image mode {image.mode}"
    rgb = image.convert("RGB") if image.mode != "L" else None
    grey = image.convert("L")

    kind, why = _classify(rgb, grey)
    if kind == "colour":
        return "kept", why
    original_size = len(raw.read_raw_bytes())

    if kind == "text":
        dpi = width / page_width_in if page_width_in > 0 else TARGET_DPI
        scale = 1
        while dpi * scale < TARGET_DPI * 0.85 and scale < MAX_UPSCALE:
            scale *= 2
        bw = _binarize(grey, scale)
        data = _encode_g4(bw)
        if data is None or len(data) >= original_size:
            return "kept", f"text, but 1-bit is not smaller ({len(data or b'')} >= {original_size} bytes)"
        black_is_1 = _g4_polarity(data, bw)
        if black_is_1 is None:
            return "kept", "text, but the 1-bit image did not decode back correctly"
        raw.write(
            data,
            filter=pikepdf.Name.CCITTFaxDecode,
            decode_parms=pikepdf.Dictionary(
                K=-1, Columns=bw.width, Rows=bw.height, BlackIs1=black_is_1
            ),
        )
        _set_image_dict(raw, bw.width, bw.height, bpc=1)
        return "bw", f"text, {scale}x"

    # Not safely text-only: greyscale is still a lossless-looking win for colourless scans
    if rgb is None:
        return "kept", why
    if raw.get("/Filter") == pikepdf.Name.DCTDecode:
        buf = io.BytesIO()
        grey.save(buf, format="JPEG", quality=90, optimize=True)
        data, filt = buf.getvalue(), pikepdf.Name.DCTDecode
    else:
        data, filt = zlib.compress(grey.tobytes(), 9), pikepdf.Name.FlateDecode
    if len(data) >= original_size:
        return "kept", f"{why}; greyscale is not smaller"
    raw.write(data, filter=filt)
    _set_image_dict(raw, grey.width, grey.height, bpc=8)
    return "grey", why


def _set_image_dict(raw, width, height, bpc):
    raw.Width, raw.Height, raw.BitsPerComponent = width, height, bpc
    raw.ColorSpace = pikepdf.Name.DeviceGray
    for key in ("/Intent", "/ColorTransform"):
        if key in raw:
            del raw[key]


def _background(grey):
    """Local paper brightness: text disappears when shrunk under a max filter."""
    w, h = grey.size
    small = grey.resize((max(1, w // 16), max(1, h // 16)), Image.BOX)
    small = small.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2))
    return small.resize((w, h), Image.BILINEAR)


def _classify(rgb, grey):
    """Return (kind, reason); kind is 'text', 'grey' (colourless, not text-only) or 'colour'."""
    scale = WORK_SIZE / max(grey.size)
    if scale < 1:
        size = (max(1, round(grey.width * scale)), max(1, round(grey.height * scale)))
        grey = grey.resize(size, Image.LANCZOS)
        rgb = rgb.resize(size, Image.LANCZOS) if rgb is not None else None

    # Darkness of each pixel relative to the local paper (uneven lighting cancels out)
    dark = ImageChops.subtract(_background(grey), grey)
    hist = dark.histogram()
    total = sum(hist)
    contrast, acc = 0, 0
    for v in range(255, -1, -1):  # ink level = 99.5th percentile of darkness
        acc += hist[v]
        if acc >= total * 0.005:
            contrast = v
            break
    ink_lo, mid_lo = int(contrast * 0.5), int(contrast * 0.2)
    ink = dark.point(lambda v: 255 if v >= max(ink_lo, 1) else 0)

    # Coloured ink (paper tint does not count: only ink pixels are looked at)
    coloured = None
    if rgb is not None:
        r, g, b = rgb.split()
        chroma = ImageChops.subtract(
            ImageChops.lighter(ImageChops.lighter(r, g), b),
            ImageChops.darker(ImageChops.darker(r, g), b),
        )
        coloured = ImageChops.multiply(
            chroma.point(lambda v: 255 if v >= COLOUR_CHROMA else 0), ink
        )
        ink_pixels = ink.histogram()[255]
        if ink_pixels and coloured.histogram()[255] > ink_pixels * COLOUR_INK_MAX:
            return "colour", f"coloured ink {coloured.histogram()[255] / ink_pixels:.1%}"

    if contrast < MIN_CONTRAST:
        return "grey", f"low contrast {contrast}"  # faint scan: thresholding could lose strokes
    if sum(hist[mid_lo:ink_lo]) > total * PAGE_MIDTONE_MAX:
        return "grey", f"mid-tones {sum(hist[mid_lo:ink_lo]) / total:.1%} of page"

    w, h = dark.size
    picture_tiles = colour_tiles = 0
    for ty in range(1, TILE_GRID - 1):
        for tx in range(1, TILE_GRID - 1):
            box = (tx * w // TILE_GRID, ty * h // TILE_GRID,
                   (tx + 1) * w // TILE_GRID, (ty + 1) * h // TILE_GRID)
            th = dark.crop(box).histogram()
            tn = sum(th)
            if tn and sum(th[mid_lo:ink_lo]) > tn * TILE_MIDTONE_MAX:
                picture_tiles += 1
            if coloured is not None:
                tile_ink = ink.crop(box).histogram()[255]
                if tile_ink > tn * 0.01 and coloured.crop(box).histogram()[255] > tile_ink * COLOUR_TILE_MAX:
                    colour_tiles += 1
    if colour_tiles >= MIN_FLAGGED_TILES:
        return "colour", f"{colour_tiles} coloured tiles"
    if picture_tiles >= MIN_FLAGGED_TILES:
        return "grey", f"{picture_tiles} picture-like tiles"
    return "text", "text only"


def _binarize(grey, scale):
    """Threshold halfway between local paper and ink brightness."""
    if scale > 1:
        grey = grey.resize((grey.width * scale, grey.height * scale), Image.LANCZOS)
    bg = _background(grey)
    dark = ImageChops.subtract(bg, grey)
    ink = dark.point(lambda v: 255 if v >= 40 else 0)
    # Typical ink brightness as a fraction of the paper under it
    ink_grey = ImageStat.Stat(grey, ink).mean[0] if ink.getbbox() else 0
    ink_bg = ImageStat.Stat(bg, ink).mean[0] if ink.getbbox() else 255
    ratio = min(max(ink_grey / ink_bg if ink_bg else 0, 0.0), 0.8)
    cutoff = (1 + ratio) / 2
    # Black where the pixel is darker than cutoff x local paper brightness
    limit = bg.point(lambda v: int(v * cutoff))
    black = ImageChops.subtract(limit, grey).point(lambda v: 255 if v > 0 else 0)
    return ImageChops.invert(black).convert("1", dither=getattr(Image, "Dither", Image).NONE)


def _encode_g4(bw):
    """CCITT Group 4 bytes for a 1-bit image, or None if not a single strip."""
    buf = io.BytesIO()
    bw.save(buf, format="TIFF", compression="group4", tiffinfo={278: bw.height})
    tiff = Image.open(io.BytesIO(buf.getvalue()))
    offsets, counts = tiff.tag_v2.get(273), tiff.tag_v2.get(279)
    if not offsets or len(offsets) != 1:
        return None
    return buf.getvalue()[offsets[0]:offsets[0] + counts[0]]


def _g4_polarity(data, bw):
    """BlackIs1 value under which the G4 data decodes to the source image.

    Which one applies depends on how Pillow/libtiff wrote the TIFF, so decode
    a scratch copy both ways instead of assuming. None if neither matches.
    """
    source = ImageStat.Stat(bw.convert("L")).mean[0]
    scratch = pikepdf.new()
    for black_is_1 in (True, False):
        image = pikepdf.Stream(scratch, data)
        image.Type, image.Subtype = pikepdf.Name.XObject, pikepdf.Name.Image
        image.Width, image.Height, image.BitsPerComponent = bw.width, bw.height, 1
        image.ColorSpace = pikepdf.Name.DeviceGray
        image.Filter = pikepdf.Name.CCITTFaxDecode
        image.DecodeParms = pikepdf.Dictionary(
            K=-1, Columns=bw.width, Rows=bw.height, BlackIs1=black_is_1
        )
        try:
            decoded = pikepdf.PdfImage(image).as_pil_image().convert("L")
        except Exception:
            continue
        if decoded.size == bw.size and abs(ImageStat.Stat(decoded).mean[0] - source) < 2:
            return black_is_1
    return None
