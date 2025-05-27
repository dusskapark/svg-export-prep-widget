# SVG Export Prep Widget

A Figma Widget that scans ComponentSets in the parent container and automatically creates organized instances for easy SVG export preparation.

## 🚀 Features

- **Component Scanning**: Automatically scans ComponentSets in the parent container
- **Instance Creation**: Creates instances of all found components with organized naming (`type/componentSetName`)

## 📦 Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/dusskapark/svg-export-prep-widget.git
   cd svg-export-prep-widget
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the widget:
   ```bash
   pnpm run build
   ```

4. Import the widget in Figma:
   - Open Figma
   - Go to Widgets → Development → Import widget from manifest
   - Select the `manifest.json` file from this project

## 🎯 Usage

1. **Place the Widget**: Add the widget to any frame or page containing ComponentSets
2. **Scan Icons**: Click the "Scan icons" button to find all ComponentSets and create instances
3. **View Results**: The widget will create an "exportSVG" frame with all component instances
4. **Retry**: Use the "Retry" button to rescan and recreate instances
5. **Reset**: Clear all data and remove the export frame

## 🛠️ Development

### Scripts
- `pnpm run dev` - Start development server with watch mode
- `pnpm run build` - Build for production

### Project Structure
```
svg-export-prep-widget/
├── src/
│   └── main.tsx          # Main widget code
├── dist/
│   └── code.js           # Built widget code
├── manifest.json         # Figma widget manifest
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite build configuration
└── README.md            # This file
```

## 📝 License

This project is licensed under the MIT License.

---

Built with ❤️ using Figma Widget API, React, TypeScript, and Vite.
