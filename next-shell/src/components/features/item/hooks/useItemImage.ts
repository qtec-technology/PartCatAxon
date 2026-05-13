import { useEffect, useState } from 'react';
import { itemApi } from '../../../../services/item.api';
import type { ItemData } from '../../../../types/item_types';
import { hasAllowedFileExtension } from '../../../../utils/file';
import { toast } from 'sonner';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_ITEM_PREVIEW_IMAGE = '/items/logo_qtec.webp';
const ALLOWED_ITEM_IMAGE_EXTENSIONS = ['.jpg', '.png', '.gif'];

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseItemImageOptions {
  initialData?: ItemData;
  canManageItemImage: boolean;
}

export function useItemImage({ initialData, canManageItemImage }: UseItemImageOptions) {
  const [previewImage, setPreviewImage] = useState<string>(DEFAULT_ITEM_PREVIEW_IMAGE);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Sync preview when initialData changes (mode switch, initial load)
  useEffect(() => {
    const itemId = initialData?.id;
    setSelectedImageFile(null);

    if (!itemId) {
      setPreviewImage(DEFAULT_ITEM_PREVIEW_IMAGE);
      return;
    }

    // Use hasImage flag from server — no HEAD request needed
    if (!initialData?.hasImage) {
      setPreviewImage(DEFAULT_ITEM_PREVIEW_IMAGE);
      return;
    }

    const cacheKey = initialData?.updatedDate ? String(initialData.updatedDate) : '';
    const imageUrl = itemApi.getItemImageUrl(itemId, cacheKey);
    if (!imageUrl) {
      setPreviewImage(DEFAULT_ITEM_PREVIEW_IMAGE);
      return;
    }

    setPreviewImage(imageUrl);
  }, [initialData?.id, initialData?.updatedDate, initialData?.hasImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageItemImage) {
      toast.info('Image upload is available in Edit mode only');
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      if (!hasAllowedFileExtension(file.name, ALLOWED_ITEM_IMAGE_EXTENSIONS)) {
        toast.error('Allowed image types: JPG, PNG, GIF');
        e.target.value = '';
        return;
      }
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageError = () => {
    setPreviewImage((prev) =>
      prev === DEFAULT_ITEM_PREVIEW_IMAGE ? prev : DEFAULT_ITEM_PREVIEW_IMAGE
    );
  };

  return {
    previewImage,
    selectedImageFile,
    handleImageUpload,
    handleImageError,
  };
}

export { DEFAULT_ITEM_PREVIEW_IMAGE };
