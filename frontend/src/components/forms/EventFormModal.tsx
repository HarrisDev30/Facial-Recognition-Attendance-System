import { useEffect, useState, useRef } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Stack,
  Group,
  Button,
  Box,
} from "@mantine/core";
import { IconPhoto, IconX } from "@tabler/icons-react";
import type { EventResponse, EventCreate } from "../../types/event";
import { getDepartments } from "../../api/departments";
import type { DepartmentResponse } from "../../types/auth";
import { EVENT_TYPE_LABELS } from "../../utils/constants";
import PhotoCropper from "../PhotoCropper";

interface EventFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: EventCreate) => void;
  initial?: EventResponse | null;
  loading?: boolean;
  photoBlob?: Blob | null;
  onPhotoChange?: (blob: Blob | null) => void;
  onRemovePhoto?: () => void;
}

function EventFormModal({
  opened,
  onClose,
  onSubmit,
  initial,
  loading,
  onPhotoChange,
  onRemovePhoto,
}: EventFormModalProps) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("seminar");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (opened) {
      getDepartments().then((res) => setDepartments(res.items));
    }
  }, [opened]);

  useEffect(() => {
    if (opened) {
      setName(initial?.name ?? "");
      setEventType(initial?.event_type ?? "seminar");
      setDescription(initial?.description ?? "");
      setVenue(initial?.venue ?? "");
      setStartDate(initial?.start_date ?? "");
      setEndDate(initial?.end_date ?? "");
      setDepartmentId((initial as any)?.department_id ?? null);
      if (initial?.photo_url) {
        setPhotoPreview(initial.photo_url);
        if (onPhotoChange) onPhotoChange(null);
      } else {
        setPhotoPreview(null);
        if (onPhotoChange) onPhotoChange(null);
      }
    }
  }, [opened, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (startDate && endDate && endDate < startDate) {
      return;
    }

    const payload: EventCreate = {
      name,
      event_type: eventType,
      description: description || null,
      venue: venue || null,
      start_date: startDate,
      end_date: endDate,
      department_id: departmentId || null,
    };
    onSubmit(payload);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCropperImage(reader.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = "";
  };

  const handleCropSave = (blob: Blob) => {
    setPhotoPreview(URL.createObjectURL(blob));
    setCropperOpen(false);
    if (onPhotoChange) onPhotoChange(blob);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    if (initial?.photo_url && onRemovePhoto) {
      onRemovePhoto();
    }
    if (onPhotoChange) onPhotoChange(null);
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={initial ? "Edit Event" : "Create Event"}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              maxLength={200}
            />
            <Select
              label="Event Type"
              value={eventType}
              onChange={(v) => setEventType(v ?? "seminar")}
              data={Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              required
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              minRows={3}
              maxLength={500}
            />
            <TextInput
              label="Venue"
              value={venue}
              onChange={(e) => setVenue(e.currentTarget.value)}
              maxLength={200}
            />

            <Box>
              {photoPreview ? (
                <Box
                  style={{
                    position: "relative",
                    borderRadius: "var(--mantine-radius-md)",
                    overflow: "hidden",
                    width: 150,
                  }}
                >
                  <img
                    src={photoPreview}
                    alt="Cover preview"
                    style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }}
                  />
                  <Group gap="xs" mt="xs">
                    <Button
                      variant="default"
                      size="xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change
                    </Button>
                    <Button
                      variant="subtle"
                      size="xs"
                      color="red"
                      leftSection={<IconX size={14} />}
                      onClick={handleRemovePhoto}
                    >
                      Remove
                    </Button>
                  </Group>
                </Box>
              ) : (
                <Box>
                  <Button
                    variant="default"
                    leftSection={<IconPhoto size={18} />}
                    onClick={() => fileInputRef.current?.click()}
                    fullWidth
                    h={80}
                  >
                    Add Cover Photo (optional)
                  </Button>
                </Box>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </Box>

            <Select
              label="Department"
              value={departmentId}
              onChange={setDepartmentId}
              data={departments.map((d) => ({ value: d.id, label: d.name }))}
              searchable
              clearable
            />
            <Group grow>
              <TextInput
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.currentTarget.value)}
                required
              />
              <TextInput
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.currentTarget.value)}
                required
              />
            </Group>
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {initial ? "Save Changes" : "Create Event"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <PhotoCropper
        opened={cropperOpen}
        imageSrc={cropperImage}
        onClose={() => setCropperOpen(false)}
        onSave={handleCropSave}
        aspectRatio={16 / 9}
        cropShape="rect"
      />
    </>
  );
}

export default EventFormModal;
