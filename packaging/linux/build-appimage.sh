#!/usr/bin/env bash
# Usage: build-appimage.sh <repo-root> <output-path>
set -euo pipefail

REPO_ROOT="${1:?usage: build-appimage.sh <repo-root> <output-path>}"
OUTPUT="${2:?usage: build-appimage.sh <repo-root> <output-path>}"
APPDIR="$(mktemp -d)/AppDir"
APPID=media.laura.dotdesktopeditor

echo "## Assembling AppDir at $APPDIR"
mkdir -p \
  "$APPDIR/usr/bin" \
  "$APPDIR/usr/lib/dotdesktop-editor" \
  "$APPDIR/usr/lib/girepository-1.0" \
  "$APPDIR/usr/lib/gdk-pixbuf-2.0" \
  "$APPDIR/usr/share/applications" \
  "$APPDIR/usr/share/icons/hicolor/scalable/apps" \
  "$APPDIR/usr/share/glib-2.0/schemas"

cp -r "$REPO_ROOT/dist" "$REPO_ROOT/node_modules" "$REPO_ROOT/package.json" \
      "$REPO_ROOT/style.css" "$REPO_ROOT/icons" "$APPDIR/usr/lib/dotdesktop-editor/"

cp "$(command -v node)" "$APPDIR/usr/bin/node"

TYPELIB_SRC="$(pkg-config --variable=typelibdir gobject-introspection-1.0)"
cp "$TYPELIB_SRC"/*.typelib "$APPDIR/usr/lib/girepository-1.0/"

mapfile -t TYPELIB_LIBNAMES < <(
  strings "$APPDIR/usr/lib/girepository-1.0"/*.typelib \
    | grep -oE '[A-Za-z0-9_.+-]+\.so(\.[0-9]+)*' \
    | tr ',' '\n' \
    | sort -u
)

mapfile -t TYPELIB_LIBPATHS < <(
  for name in "${TYPELIB_LIBNAMES[@]}"; do
    ldconfig -p | awk -v n="$name" '$1 == n {print $NF; exit}'
  done | sort -u
)

mapfile -t SEED_LIBS < <(
  {
    echo "$APPDIR/usr/bin/node"
    find "$APPDIR/usr/lib/dotdesktop-editor/node_modules" -name '*.node'
    ldconfig -p | grep -E 'libgtk-4\.so|libadwaita-1\.so' | awk '{print $NF}'
    printf '%s\n' "${TYPELIB_LIBPATHS[@]}"
  } | sort -u
)

EXCLUDE_RE='^lib(c|m|dl|pthread|rt|resolv|util|nsl|gcc_s)\.so|^ld-linux|^libGL\.so|^libGLX|^libEGL|^libX11\.so|^libX11-xcb|^libxcb|^libdrm'

: > /tmp/so-closure.txt
for lib in "${SEED_LIBS[@]}"; do
  [ -f "$lib" ] || continue
  echo "$lib" >> /tmp/so-closure.txt
  ldd "$lib" 2>/dev/null | sed -n 's/.*=> \(\/[^ ]*\) (0x.*/\1/p' >> /tmp/so-closure.txt || true
done
sort -u -o /tmp/so-closure.txt /tmp/so-closure.txt

while IFS= read -r so; do
  [ -f "$so" ] || continue
  base="$(basename "$so")"
  [[ "$base" =~ $EXCLUDE_RE ]] && continue
  cp -n "$so" "$APPDIR/usr/lib/" 2>/dev/null || true
done < /tmp/so-closure.txt
echo "## Bundled $(find "$APPDIR/usr/lib" -maxdepth 1 -name '*.so*' | wc -l) shared libraries"

PIXBUF_MODULEDIR="$(pkg-config --variable=gdk_pixbuf_moduledir gdk-pixbuf-2.0 2>/dev/null || true)"
if [ -n "$PIXBUF_MODULEDIR" ] && [ -d "$PIXBUF_MODULEDIR" ]; then
  cp "$PIXBUF_MODULEDIR"/*.so "$APPDIR/usr/lib/gdk-pixbuf-2.0/" 2>/dev/null || true
  GDK_PIXBUF_MODULEDIR="$APPDIR/usr/lib/gdk-pixbuf-2.0" \
    gdk-pixbuf-query-loaders "$APPDIR/usr/lib/gdk-pixbuf-2.0"/*.so \
    > "$APPDIR/usr/lib/gdk-pixbuf-2.0/loaders.cache" 2>/dev/null || true
  sed -i "s#$APPDIR#\$APPDIR#g" "$APPDIR/usr/lib/gdk-pixbuf-2.0/loaders.cache" 2>/dev/null || true
fi

copy_tree() { [ -d "$1" ] && { mkdir -p "$2"; cp -r "$1"/. "$2"/ 2>/dev/null || true; }; }
copy_tree /usr/share/icons/Adwaita "$APPDIR/usr/share/icons/Adwaita"
copy_tree /usr/share/icons/hicolor "$APPDIR/usr/share/icons/hicolor"
cp /usr/share/glib-2.0/schemas/*.xml "$APPDIR/usr/share/glib-2.0/schemas/" 2>/dev/null || true
glib-compile-schemas "$APPDIR/usr/share/glib-2.0/schemas/" 2>/dev/null || true

cp "$REPO_ROOT/packaging/linux/media.laura.dotdesktopeditor.desktop" "$APPDIR/$APPID.desktop"
cp "$REPO_ROOT/packaging/linux/media.laura.dotdesktopeditor.desktop" "$APPDIR/usr/share/applications/$APPID.desktop"
cp "$REPO_ROOT/icons/$APPID.svg" "$APPDIR/$APPID.svg"
cp "$REPO_ROOT/icons/$APPID.svg" "$APPDIR/usr/share/icons/hicolor/scalable/apps/$APPID.svg"
ln -sf "$APPID.svg" "$APPDIR/.DirIcon"

cat > "$APPDIR/AppRun" <<'APPRUN'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
export LD_LIBRARY_PATH="$HERE/usr/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GI_TYPELIB_PATH="$HERE/usr/lib/girepository-1.0"
export GDK_PIXBUF_MODULE_FILE="$HERE/usr/lib/gdk-pixbuf-2.0/loaders.cache"
export XDG_DATA_DIRS="$HERE/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
export GSETTINGS_SCHEMA_DIR="$HERE/usr/share/glib-2.0/schemas"
cd "$HERE/usr/lib/dotdesktop-editor" || exit 1
exec "$HERE/usr/bin/node" --import node-gtk/register dist/main.js "$@"
APPRUN
chmod +x "$APPDIR/AppRun"

echo "## Downloading appimagetool"
curl -fsSL -o /tmp/appimagetool \
  https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x /tmp/appimagetool

echo "## Running appimagetool"
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 /tmp/appimagetool "$APPDIR" "$OUTPUT"
echo "## Wrote $OUTPUT"
