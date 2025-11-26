# STM32 Professional Compiler

**Open-source professional STM32 development environment for VS Code / VSCodium**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Published-green)](https://open-vsx.org/extension/bytaymur/stm32-professional-compiler)

## Features

🚀 **Optimized Build Profiles**
- 6 optimization levels: O0, O1, O2, O3, Os, Og
- Professional-grade GCC ARM optimization flags
- Link-time optimization (LTO) support

📊 **Real-Time Monitor**
- Live variable watching
- Real-time value editing during debug
- Memory usage graphs
- Performance visualization

🔧 **CubeMX Integration**
- Auto-detect STM32CubeMX projects
- Preserve original Makefile while adding optimizations
- One-click project setup

🐛 **Debug Support**
- OpenOCD integration
- ST-Link, J-Link, CMSIS-DAP support
- Breakpoints, stepping, memory view
- Live variable modification

## Quick Start

1. **Install Prerequisites**
   ```bash
   # Ubuntu/Debian
   sudo apt install gcc-arm-none-eabi openocd gdb-multiarch

   # Arch Linux
   sudo pacman -S arm-none-eabi-gcc openocd

   # macOS
   brew install arm-none-eabi-gcc openocd
   ```

2. **Open CubeMX Project**
   - Open your STM32CubeMX generated project folder in VS Code
   - The extension auto-activates when it detects `.ioc` or `Makefile`

3. **Setup**
   - Click STM32 icon in sidebar → Setup Project
   - Select your optimization profile
   - Build & Flash!

## Build Profiles

| Profile | Description | Use Case |
|---------|-------------|----------|
| **O0** | No optimization | Debugging |
| **O1** | Basic optimization | Development |
| **O2** | Standard optimization | Production |
| **O3** | Aggressive optimization | Performance critical |
| **Os** | Size optimization | Flash constrained |
| **Og** | Debug-friendly optimization | Debug + some optimization |

## Commands

All commands are available via Command Palette (`Ctrl+Shift+P`):

- `STM32: Build Project` - Build with selected profile
- `STM32: Flash Firmware` - Flash to device
- `STM32: Start Debug Session` - Start debugging
- `STM32: Open Live Monitor` - Real-time variable monitor
- `STM32: Setup Project` - Configure project
- `STM32: Clean Build` - Clean build artifacts

## Supported Devices

All STM32 families:
- STM32F0, F1, F2, F3, F4, F7
- STM32G0, G4
- STM32H7
- STM32L0, L1, L4, L5
- STM32U5
- STM32WB, WL

## Requirements

- ARM GCC Toolchain (`arm-none-eabi-gcc`)
- OpenOCD (for flashing/debugging)
- STM32CubeMX generated project (optional)

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

**Muhammed Taymur** - [@ByTaymur](https://github.com/ByTaymur)

---

Made with ❤️ for the embedded community
