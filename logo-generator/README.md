# 0xterm Logo Generator

Generates the 0xterm icon: a blue hexagon with a centered cyan "0x_",
as PNG, SVG, and ICO favicon. No wordmark or tagline.

## Setup

Requires Python 3.9+ and the dependencies:

```bash
pip3 install -r requirements.txt
```

## Usage

```bash
python3 generate_logo.py
```

Outputs are written to `logo-generator/output/`:

| File                      | Description                                |
| ------------------------- | ------------------------------------------ |
| `icon.png`                | Color icon (blue hex + cyan `0x_`, transparent bg) |
| `icon_monochrome.png`     | Black hex + white `0x_` (for light bgs)    |
| `icon.svg`                | Vector color icon                          |
| `icon_monochrome.svg`     | Vector black/white icon                    |
| `favicon.ico`             | Multi-size favicon (16–256 px)             |

The `output/` directory is gitignored so generated binaries aren't committed.

## Customization

Colors and dimensions are configurable at the top of `generate_logo.py`
under the `--- Configuration ---` section.
