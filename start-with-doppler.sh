#!/bin/bash

# Ensure doppler is available in PATH
export PATH=$PATH:~/.local/bin:$(pwd)

# Copy doppler to local bin if not already there
if [ ! -f ~/.local/bin/doppler ]; then
    mkdir -p ~/.local/bin
    cp doppler ~/.local/bin/doppler
fi

# Run the original command
exec "$@"