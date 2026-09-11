#!/bin/sh
cd /app/lib/dotdesktop-editor || exit 1
exec ./node --import node-gtk/register dist/main.js "$@"
