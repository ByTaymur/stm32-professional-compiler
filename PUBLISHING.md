# Open VSX Yayınlama Rehberi

## 1. GitHub Repo Oluştur

GitHub'da `stm32-professional-compiler` adında yeni repo oluştur:
https://github.com/new

Repository name: `stm32-professional-compiler`
Description: Open-source professional STM32 development environment for VS Code
Public: ✓
Initialize with README: ✗ (zaten var)

## 2. Yerel Dosyaları GitHub'a Yükle

```bash
cd /path/to/stm32-pro-openvsx

git init
git add .
git commit -m "Initial release v1.0.0"
git branch -M main
git remote add origin https://github.com/ByTaymur/stm32-professional-compiler.git
git push -u origin main
```

## 3. Open VSX Namespace Oluştur

1. https://open-vsx.org/ adresine git
2. Eclipse hesabınla giriş yap (bytaymur)
3. Settings → Namespaces → Create Namespace
4. Namespace: `bytaymur` (küçük harf!)

## 4. Access Token Al

1. Open VSX'te: Settings → Access Tokens
2. "Generate Token" tıkla
3. Token'ı kopyala ve sakla

## 5. VSIX'i Yayınla

### Yöntem A: Web Arayüzü (En Kolay)
1. https://open-vsx.org/user-settings/extensions adresine git
2. "Publish Extension" tıkla
3. VSIX dosyasını sürükle-bırak

### Yöntem B: CLI ile
```bash
# ovsx CLI kur
npm install -g ovsx

# Token ile yayınla
ovsx publish stm32-professional-compiler-1.0.0.vsix -p <ACCESS_TOKEN>
```

## 6. Doğrulama

Yayınlandıktan sonra:
https://open-vsx.org/extension/bytaymur/stm32-professional-compiler

## Dikkat Edilecekler

✅ MIT Lisansı var
✅ README.md var
✅ CHANGELOG.md var
✅ icon.png (128x128) var
✅ repository URL'si doğru
✅ publisher: "bytaymur" (Open VSX namespace ile aynı!)

## Güncellemeler İçin

1. package.json'da version artır (1.0.1, 1.1.0, vb.)
2. CHANGELOG.md güncelle
3. Yeniden paketle: `npx @vscode/vsce package`
4. Yayınla: `ovsx publish <yeni-vsix> -p <TOKEN>`
