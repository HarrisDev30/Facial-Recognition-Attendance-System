import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PinInput,
  TextInput,
  Select,
  Button,
  Paper,
  Title,
  Text,
  Alert,
  Group,
  Stack,
  ThemeIcon,
  Badge,
} from "@mantine/core";
import {
  IconDeviceLaptop,
  IconCheck,
  IconAlertCircle,
  IconCamera,
  IconBuildingArch,
  IconArrowRight,
} from "@tabler/icons-react";
import { pairDevice } from "../api/devices";
import type { DevicePairResponse } from "../api/devices";
import "./ScannerPairingPage.css";

export default function ScannerPairingPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<string>("workstation_laptop");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairedDevice, setPairedDevice] = useState<DevicePairResponse | null>(null);

  // Camera preview test
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCameraTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setCameraActive(false);
    }
  };

  useEffect(() => {
    // Default device name based on browser/screen
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setDeviceName(isMobile ? "Mobile Entrance Scanner" : "Entrance Laptop Kiosk");
    setDeviceType(isMobile ? "mobile_scanner" : "workstation_laptop");
    startCameraTest();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handlePair = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit pairing code.");
      return;
    }
    if (!deviceName.trim()) {
      setError("Please provide a name for this scanner device.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await pairDevice({
        code,
        name: deviceName.trim(),
        device_type: deviceType,
        location: location.trim() || undefined,
      });

      // Store persistent device credentials in localStorage
      localStorage.setItem("attendify_device_token", res.device_token);
      localStorage.setItem("attendify_device_id", res.device_id);
      localStorage.setItem("attendify_institution_id", res.institution_id);
      localStorage.setItem("attendify_institution_name", res.institution_name);

      setPairedDevice(res);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to pair scanner. Check that the 6-digit code is valid and has not expired.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pairing-page-root">
      <div className="pairing-bg-glow" />

      <div className="pairing-container">
        {pairedDevice ? (
          <Paper className="pairing-card success-card" p="2.5rem" radius="xl">
            <Stack align="center" gap="md">
              <ThemeIcon size={72} radius="xl" color="teal" variant="light">
                <IconCheck size={40} stroke={2.5} />
              </ThemeIcon>

              <Title order={2} className="pairing-title">
                Scanner Paired Successfully!
              </Title>

              <Badge size="lg" variant="filled" color="teal">
                {pairedDevice.institution_name} ({pairedDevice.institution_code})
              </Badge>

              <Text size="sm" c="dimmed" ta="center" style={{ maxWidth: 360 }}>
                This hardware kiosk is now authenticated to process live biometric attendance sessions for <strong>{pairedDevice.name}</strong>.
              </Text>

              <Group mt="xl" gap="md">
                <Button
                  size="md"
                  color="teal"
                  rightSection={<IconArrowRight size={18} />}
                  onClick={() => navigate("/marshal/events")}
                >
                  Go to Active Events
                </Button>
                <Button
                  size="md"
                  variant="default"
                  onClick={() => setPairedDevice(null)}
                >
                  Pair Another Device
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : (
          <Paper className="pairing-card" p="2.5rem" radius="xl">
            <Stack gap="lg">
              <Group gap="md">
                <ThemeIcon size={48} radius="md" color="blue" variant="light">
                  <IconDeviceLaptop size={28} />
                </ThemeIcon>
                <div>
                  <Title order={2} className="pairing-title">
                    Pair Hardware Scanner
                  </Title>
                  <Text size="sm" c="dimmed">
                    Enter the 6-digit pairing code generated by your University Admin.
                  </Text>
                </div>
              </Group>

              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="red"
                  variant="light"
                  radius="md"
                  title="Pairing Failed"
                >
                  {error}
                </Alert>
              )}

              <form onSubmit={handlePair}>
                <Stack gap="md">
                  <div>
                    <Text fw={600} size="sm" mb={8}>
                      6-Digit Admin Pairing Code
                    </Text>
                    <Group justify="center">
                      <PinInput
                        length={6}
                        size="xl"
                        type="number"
                        placeholder="○"
                        value={code}
                        onChange={setCode}
                        autoFocus
                      />
                    </Group>
                  </div>

                  <TextInput
                    label="Scanner Device Name"
                    placeholder="e.g. North Gate Kiosk 1"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.currentTarget.value)}
                    required
                  />

                  <Select
                    label="Device Type"
                    data={[
                      { value: "workstation_laptop", label: "Workstation / Laptop Kiosk" },
                      { value: "mobile_scanner", label: "Handheld Mobile Scanner" },
                      { value: "dedicated_scanner", label: "Dedicated Turnstile Camera" },
                    ]}
                    value={deviceType}
                    onChange={(val) => setDeviceType(val || "workstation_laptop")}
                  />

                  <TextInput
                    label="Location / Gate (Optional)"
                    placeholder="e.g. Main Gymnasium Lobby"
                    value={location}
                    onChange={(e) => setLocation(e.currentTarget.value)}
                  />

                  {/* Camera hardware test */}
                  <div>
                    <Text size="xs" c="dimmed" mb={4} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <IconCamera size={14} /> Camera Hardware Status: {cameraActive ? "Connected" : "Standby"}
                    </Text>
                    <div className="pairing-camera-preview">
                      <video ref={videoRef} playsInline muted autoPlay />
                      {!cameraActive && (
                        <Text size="xs" c="dimmed" ta="center">
                          Webcam initializing...
                        </Text>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    color="blue"
                    fullWidth
                    loading={loading}
                    disabled={code.length !== 6}
                    mt="md"
                  >
                    Authenticate & Pair Kiosk
                  </Button>
                </Stack>
              </form>

              <Group justify="center" gap="xs" mt="xs">
                <IconBuildingArch size={14} style={{ opacity: 0.5 }} />
                <Text size="xs" c="dimmed">
                  Attendify Hardware Kiosk Integration
                </Text>
              </Group>
            </Stack>
          </Paper>
        )}
      </div>
    </div>
  );
}
