# STM32 Professional Compiler

**Open-source professional STM32 development environment for VS Code / VSCodium**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Published-green)](https://open-vsx.org/extension/bytaymur/stm32-professional-compiler)

## ✨ Features

### 🚀 **Smart Toolchain Management**
- **Auto-detection**: Automatically finds ARM GCC, GDB, OpenOCD, Make, and CMake in your system
- **Cross-platform**: Works seamlessly on Linux, macOS, and Windows
- **Installation guide**: Provides platform-specific installation instructions for missing tools
- **xPack support**: Compatible with portable xPack toolchains

### 📊 **Optimized Build Profiles**
- 6 optimization levels: `O0`, `O1`, `O2`, `O3`, `Os`, `Og`
- Professional-grade GCC ARM optimization flags
- Link-time optimization (LTO) support
- Memory usage reporting

### 🔧 **Dual Build System Support**
- **Makefile**: Traditional build system (default)
- **CMake**: Modern CMake support with automatic toolchain configuration
- Parallel builds (`-j` flag auto-configured)
- Build profile injection without modifying source files

### 📱 **Intelligent Device Detection**
- Auto-detect STM32 devices from:
  - `.ioc` files (CubeMX projects)
  - Makefile definitions
  - Linker scripts
- Supports all STM32 families (F0, F1, F2, F3, F4, F7, G0, G4, H7, L0, L1, L4, L5, U5, WB, WL)

### 🔍 **SVD File Management**
- Automatic SVD file download from CMSIS-SVD repository
- Local caching for offline use
- Enhanced peripheral debugging with register visualization

### ⚡ **Multi-Programmer Support**
- **ST-Link**: Official STMicroelectronics programmer
- **J-Link**: SEGGER J-Link support
- **CMSIS-DAP**: Generic CMSIS-DAP compatible devices
- Auto-detection with platform-aware strategies
- Connection testing before flashing

### 🐛 **Debug Support**
- OpenOCD integration
- Automatic `launch.json` configuration
- cortex-debug extension integration
- Live variable modification support

## 🚀 Quick Start

### 1. Install Prerequisites

#### Ubuntu/Debian
```bash
sudo apt install gcc-arm-none-eabi openocd gdb-multiarch build-essential
```

#### Arch Linux
```bash
sudo pacman -S arm-none-eabi-gcc arm-none-eabi-gdb openocd make
```

#### macOS
```bash
brew install arm-none-eabi-gcc openocd
brew install --cask gcc-arm-embedded
```

#### Windows
Download and install:
- [ARM GCC Toolchain](https://developer.arm.com/tools-and-software/open-source-software/developer-tools/gnu-toolchain/gnu-rm)
- [OpenOCD](https://github.com/xpack-dev-tools/openocd-xpack/releases)
- [Make for Windows](https://gnuwin32.sourceforge.net/packages/make.htm)

> 💡 **Tip**: Use [xPack](https://xpack.github.io/) for portable, cross-platform toolchains!

### 2. Open STM32 Project

Open your STM32CubeMX generated project folder in VS Code. The extension auto-activates when it detects:
- `.ioc` files
- `Makefile`
- `CMakeLists.txt`

### 3. Setup & Build

1. Click the STM32 icon in the sidebar
2. Run **STM32: Setup Project**
   - Extension will validate your toolchain
   - Auto-detect your STM32 device
   - Select your build profile
3. Click **Build** to compile
4. Click **Flash** to upload firmware

## 📖 Build Profiles

| Profile | Optimization | Use Case |
|---------|-------------|----------|
| **O0** | None (`-O0 -g3 -DDEBUG`) | Debugging, step-through |
| **O1** | Basic (`-O1 -g2`) | Development |
| **O2** | Standard (`-O2 -g1 -flto`) | **Production (default)** |
| **O3** | Aggressive (`-O3 -flto -funroll-loops`) | Performance critical |
| **Os** | Size (`-Os -flto -fdata-sections`) | Flash constrained |
| **Og** | Debug-friendly (`-Og -g3`) | Debug + optimization |

## 🎮 Commands

All commands available via Command Palette (`Ctrl+Shift+P`):

- `STM32: Build Project` - Build with selected profile
- `STM32: Flash Firmware` - Flash to device
- `STM32: Start Debug Session` - Start debugging
- `STM32: Test Connection` - Verify device connection
- `STM32: Setup Project` - Full project setup wizard
- `STM32: Clean Build` - Clean build artifacts
- `STM32: Disconnect` - Disconnect from device

## ⚙️ Configuration

Access via Settings (`Ctrl+,`) → Search "STM32"

| Setting | Default | Description |
|---------|---------|-------------|
| `stm32-pro.defaultProfile` | `O2` | Default build optimization profile |
| `stm32-pro.buildSystem` | `makefile` | Build system: `makefile` or `cmake` |
| `stm32-pro.autoFlash` | `false` | Auto-flash after successful build |
| `stm32-pro.preferredProgrammer` | `auto` | Programmer type: `auto`, `stlink`, `jlink`, `cmsis-dap` |
| `stm32-pro.gccPath` | `arm-none-eabi-gcc` | Custom GCC path (leave default for auto-detection) |
| `stm32-pro.openocdPath` | `openocd` | Custom OpenOCD path |
| `stm32-pro.svdCachePath` | `<storage>` | SVD files cache directory |

## 🏗️ Architecture

```
stm32-professional-compiler/
├── src/
│   ├── extension.ts           # Main extension entry
│   ├── types/                 # TypeScript type definitions
│   ├── services/
│   │   ├── ToolchainManager   # Toolchain detection & validation
│   │   ├── DeviceManager      # STM32 device detection & SVD
│   │   ├── BuildService       # Build operations (Make/CMake)
│   │   ├── FlashService       # Flash operations (OpenOCD/J-Link)
│   │   └── ConfigManager      # VS Code settings management
│   └── utils/
│       ├── PathUtils          # Cross-platform path handling
│       ├── ProcessUtils       # Cross-platform subprocess
│       └── DetectionUtils     # Device/toolchain detection
```

## 🐛 Troubleshooting

### Toolchain Not Found
Run **STM32: Setup Project** → **Check Toolchain** to see which tools are missing and get installation instructions.

### Build Fails
- Ensure your Makefile is compatible (CubeMX generated Makefiles work  out-of-the-box)
- Check Output panel for detailed error messages
- Try **Clean Build** and rebuild

### Flash Fails
- Run **STM32: Test Connection** to verify device is connected
- Check if ST-Link/J-Link drivers are installed
- Ensure no other program is using the programmer (close STM32CubeIDE/STM32CubeProgrammer)

### Device Not Detected
- Extension looks for `.ioc`, `Makefile`, or linker scripts
- You can manually specify device type in future versions
- Check if project structure matches CubeMX layout

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👤 Author

**Muhammed Taymur** - [@ByTaymur](https://github.com/ByTaymur)

## 🙏 Acknowledgments

- Inspired by [STM32-for-VSCode](https://github.com/bmd-studio/stm32-for-vscode)
- Uses [cortex-debug](https://marketplace.visualstudio.com/items?itemName=marus25.cortex-debug) for debugging
- SVD files from [CMSIS-SVD](https://github.com/posborne/cmsis-svd)

---

Made with ❤️ for the embedded community

**Version**: 1.0.0 | **Node**: ≥18.0.0 | **VS Code**: ≥1.80.0
