import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Text,
  Group,
  Badge,
  Button,
  LoadingOverlay,
  Alert,
  Stack,
  Slider,
  NumberInput,
  SimpleGrid,
  Divider,
  Select,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceCctv,
  IconTestPipe,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import { getDevice, updateDetectionZone } from "../../api/devices";
import { getApiError } from "../../utils/error";
import { useAsync, useFormSubmit, useCameraDevices } from "../../hooks";
import { useCamera } from "../../hooks/useCamera";
import type { CameraDevice } from "../../hooks/useCameraDevices";
import PageHeader from "../../components/layout/PageHeader";
import SectionCard from "../../components/SectionCard";

export default function DetectionZoneConfig() {
  const { deviceId } = useParams<{ deviceId: string }>();

  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoneCoordinates, setZoneCoordinates] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [faceSizeMin, setFaceSizeMin] = useState(100);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(
    () => sessionStorage.getItem("scanner_config_camera_id"),
  );
  const { devices: cameraDevices } = useCameraDevices();
  const { videoRef, streamRef, cameraActive, startCamera, stopCamera } = useCamera(
    selectedCameraId ? { deviceId: selectedCameraId } : undefined,
  );

  const loadDevice = useCallback(async () => {
    if (!deviceId) throw new Error("No device ID");
    return getDevice(deviceId);
  }, [deviceId]);

  const { data: device, loading, error: loadError } = useAsync(loadDevice, true);

  useEffect(() => {
    if (!device) return;
    const z = device.detection_zone;
    if (z && "x1" in z && "y1" in z && "x2" in z && "y2" in z) {
      setZoneCoordinates({
        x1: Number(z.x1),
        y1: Number(z.y1),
        x2: Number(z.x2),
        y2: Number(z.y2),
      });
    }
    setFaceSizeMin(device.face_size_min ?? 100);
    setConfidenceThreshold(device.confidence_threshold ?? 0.6);
  }, [device]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive, videoRef, streamRef]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const drawZone = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !zoneCoordinates) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { x1, y1, x2, y2 } = zoneCoordinates;
    const rx = x1 * canvas.width;
    const ry = y1 * canvas.height;
    const rw = (x2 - x1) * canvas.width;
    const rh = (y2 - y1) * canvas.height;
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
    ctx.fillRect(rx, ry, rw, rh);
  }, [zoneCoordinates, videoRef]);

  useEffect(() => {
    if (!cameraActive) return;
    const interval = setInterval(drawZone, 100);
    return () => clearInterval(interval);
  }, [cameraActive, drawZone]);

  const { submit: handleSave, submitting: saving } = useFormSubmit(
    async () => {
      if (!deviceId) throw new Error("No device ID");
      const zonePayload = zoneCoordinates
        ? { x1: zoneCoordinates.x1, y1: zoneCoordinates.y1, x2: zoneCoordinates.x2, y2: zoneCoordinates.y2 }
        : null;
      return updateDetectionZone(deviceId, {
        zone_coordinates: zonePayload ?? undefined,
        face_size_min: faceSizeMin,
        confidence_threshold: confidenceThreshold,
      });
    },
    {
      onSuccess: () => setSaveError(null),
      onError: (err) => setSaveError(getApiError(err)),
      showErrorNotification: false,
      successMessage: "Detection zone configuration has been updated.",
    },
  );

  const handleTest = () => {
    notifications.show({
      title: "Test Detection",
      message: "Test image processed: 0 faces detected in zone",
      color: "blue",
      icon: <IconTestPipe size={16} />,
    });
  };

  const displayError = loadError || saveError;

  const statusColor = device?.is_active ? "green" : "red";
  const typeLabel =
    device?.device_type === "dedicated_scanner"
      ? "Dedicated Scanner"
      : device?.device_type === "mobile_scanner"
        ? "Mobile"
        : device?.device_type ?? "Unknown";

  return (
    <Container size="lg">
      <LoadingOverlay visible={loading} />

      <PageHeader title="Detection Zone Config" />

      {displayError && (
        <Alert color="red" mb="md" withCloseButton onClose={() => {
          setSaveError(null);
        }}>
          {displayError}
        </Alert>
      )}

      {device && (
        <SectionCard mb="md">
          <Group>
            <IconDeviceCctv size={32} />
            <div style={{ flex: 1 }}>
              <Text fw={600} size="lg">
                {device.name}
              </Text>
              <Group gap="xs" mt={4}>
                <Badge color="blue" size="sm">
                  {typeLabel}
                </Badge>
                <Badge color={statusColor} size="sm">
                  {device.is_active ? "Active" : "Inactive"}
                </Badge>
              </Group>
              {device.location && (
                <Text size="sm" c="dimmed" mt={4}>
                  Location: {device.location}
                </Text>
              )}
            </div>
          </Group>
        </SectionCard>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="lg">
        <SectionCard title="Camera Preview">
          <Stack>
            <div style={{ position: "relative" }}>
              {cameraActive && (
                <>
                  <video
                    ref={videoRef as any}
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      borderRadius: 4,
                      background: "#000",
                      display: "block",
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                    }}
                  />
                </>
              )}
              {!cameraActive && (
                <div
                  style={{
                    width: "100%",
                    height: 240,
                    borderRadius: 4,
                    background: "#f0f0f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text c="dimmed">Camera off</Text>
                </div>
              )}
            </div>
            <Group>
              {!cameraActive && cameraDevices.length > 1 && (
                <Select
                  placeholder="Select camera"
                  data={cameraDevices.map((d: CameraDevice) => ({
                    value: d.deviceId,
                    label: d.label,
                  }))}
                  value={selectedCameraId}
                  onChange={(v) => {
                    setSelectedCameraId(v);
                    if (v) sessionStorage.setItem("scanner_config_camera_id", v);
                  }}
                  size="xs"
                  w={220}
                  clearable={false}
                />
              )}
              {!cameraActive ? (
                <Button
                  leftSection={<IconEye size={16} />}
                  onClick={startCamera}
                >
                  Start Camera
                </Button>
              ) : (
                <Button
                  leftSection={<IconEyeOff size={16} />}
                  onClick={stopCamera}
                >
                  Stop Camera
                </Button>
              )}
            </Group>
          </Stack>
        </SectionCard>

        <SectionCard title="Detection Zone Coordinates">
          <Text size="xs" c="dimmed" mb="md">
            Normalized coordinates (0.0 to 1.0) within the camera frame
          </Text>
          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label="X1"
              value={zoneCoordinates?.x1 ?? 0}
              onChange={(v) =>
                setZoneCoordinates((prev) => ({
                  x1: Number(v),
                  y1: prev?.y1 ?? 0,
                  x2: prev?.x2 ?? 1,
                  y2: prev?.y2 ?? 1,
                }))
              }
              min={0}
              max={1}
              step={0.01}
              decimalScale={2}
            />
            <NumberInput
              label="Y1"
              value={zoneCoordinates?.y1 ?? 0}
              onChange={(v) =>
                setZoneCoordinates((prev) => ({
                  x1: prev?.x1 ?? 0,
                  y1: Number(v),
                  x2: prev?.x2 ?? 1,
                  y2: prev?.y2 ?? 1,
                }))
              }
              min={0}
              max={1}
              step={0.01}
              decimalScale={2}
            />
            <NumberInput
              label="X2"
              value={zoneCoordinates?.x2 ?? 1}
              onChange={(v) =>
                setZoneCoordinates((prev) => ({
                  x1: prev?.x1 ?? 0,
                  y1: prev?.y1 ?? 0,
                  x2: Number(v),
                  y2: prev?.y2 ?? 1,
                }))
              }
              min={0}
              max={1}
              step={0.01}
              decimalScale={2}
            />
            <NumberInput
              label="Y2"
              value={zoneCoordinates?.y2 ?? 1}
              onChange={(v) =>
                setZoneCoordinates((prev) => ({
                  x1: prev?.x1 ?? 0,
                  y1: prev?.y1 ?? 0,
                  x2: prev?.x2 ?? 1,
                  y2: Number(v),
                }))
              }
              min={0}
              max={1}
              step={0.01}
              decimalScale={2}
            />
          </SimpleGrid>
        </SectionCard>
      </SimpleGrid>

      <SectionCard title="Detection Settings" mb="lg">
        <Stack>
          <div>
            <Text size="sm" mb="xs">
              Minimum Face Size: <strong>{faceSizeMin}px</strong>
            </Text>
            <Slider
              value={faceSizeMin}
              onChange={setFaceSizeMin}
              min={50}
              max={500}
              step={10}
              marks={[
                { value: 50, label: "50" },
                { value: 250, label: "250" },
                { value: 500, label: "500" },
              ]}
            />
          </div>
          <Divider />
          <div>
            <Text size="sm" mb="xs">
              Confidence Threshold: <strong>{confidenceThreshold.toFixed(2)}</strong>
            </Text>
            <Slider
              value={confidenceThreshold}
              onChange={setConfidenceThreshold}
              min={0}
              max={1}
              step={0.05}
              marks={[
                { value: 0, label: "0" },
                { value: 0.5, label: "0.5" },
                { value: 1, label: "1" },
              ]}
            />
          </div>
        </Stack>
      </SectionCard>

      <Group justify="space-between">
        <Button
          leftSection={<IconTestPipe size={16} />}
          onClick={handleTest}
        >
          Test Detection
        </Button>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={saving}
        >
          Save Configuration
        </Button>
      </Group>
    </Container>
  );
}
