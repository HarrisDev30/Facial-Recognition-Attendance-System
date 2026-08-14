import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Modal, Slider, Group, Button, Box } from "@mantine/core";

interface PhotoCropperProps {
  opened: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onSave: (blob: Blob) => void;
  aspectRatio?: number;
  cropShape?: "round" | "rect";
}

function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/jpeg",
        0.9,
      );
    };
    image.onerror = () => reject(new Error("Failed to load image"));
  });
}

export default function PhotoCropper({
  opened,
  imageSrc,
  onClose,
  onSave,
  aspectRatio = 1,
  cropShape = "round",
}: PhotoCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(blob);
    } catch {
      // ignored
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Adjust photo"
      size="md"
      closeOnClickOutside={false}
    >
      {imageSrc && (
        <>
          <Box style={{ position: "relative", width: "100%", height: 360, background: "#000" }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </Box>

          <Group mt="md" mb="xs">
            <span style={{ fontSize: 13 }}>−</span>
            <Slider
              value={zoom}
              onChange={setZoom}
              min={1}
              max={3}
              step={0.1}
              style={{ flex: 1 }}
              label={(v) => `${Math.round(v * 100)}%`}
            />
            <span style={{ fontSize: 13 }}>+</span>
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
          </Group>
        </>
      )}
    </Modal>
  );
}
