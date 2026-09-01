import * as ImageManipulator from 'expo-image-manipulator';

export const scannerUtils = {
  async enhanceImage(uri, filter = 'auto') {
    try {
      let manipulations = [];

      if (filter === 'grayscale' || filter === 'auto') {
        manipulations.push({ colorize: { amount: 1 } });
      }

      if (filter === 'bw') {
        manipulations.push({ contrast: 1.5 });
      }

      if (filter === 'auto' || filter === 'enhance') {
        manipulations.push({ contrast: 1.2 });
        manipulations.push({ blur: 1 });
      }

      if (manipulations.length === 0) {
        return uri;
      }

      const result = await ImageManipulator.manipulateAsync(uri, manipulations, {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      return result.uri;
    } catch (e) {
      console.warn('Image enhancement failed:', e);
      return uri;
    }
  },

  async cropImage(uri, cropData) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: cropData }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
      throw new Error(`Image crop failed: ${e.message}`);
    }
  },

  async rotateImage(uri, degrees) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ rotate: degrees }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
      throw new Error(`Image rotation failed: ${e.message}`);
    }
  },

  async resizeImage(uri, width, height) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width, height } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
      throw new Error(`Image resize failed: ${e.message}`);
    }
  },

  async applyFilter(uri, filterType) {
    try {
      let manipulations = [];

      switch (filterType) {
        case 'original':
          return uri;
        case 'grayscale':
          manipulations = [{ colorize: { amount: 1 } }];
          break;
        case 'bw':
          manipulations = [{ contrast: 2 }, { colorize: { amount: 1 } }];
          break;
        case 'enhance':
          manipulations = [{ contrast: 1.3 }, { blur: 0.5 }];
          break;
        default:
          return uri;
      }

      const result = await ImageManipulator.manipulateAsync(uri, manipulations, {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      return result.uri;
    } catch (e) {
      console.warn('Filter application failed:', e);
      return uri;
    }
  },

  detectDocumentBounds(imageWidth, imageHeight, padding = 0.15) {
    // Simplified document bounds detection
    const w = imageWidth;
    const h = imageHeight;
    const p = padding;

    return {
      originX: w * p,
      originY: h * p,
      width: w * (1 - 2 * p),
      height: h * (1 - 2 * p),
    };
  },

  isDocumentAligned(width, height, tolerance = 0.1) {
    // Simple check: document should be roughly rectangular
    if (width < 100 || height < 100) return false;
    const ratio = Math.max(width, height) / Math.min(width, height);
    return ratio < 3; // Document shouldn't be extremely stretched
  },
};
