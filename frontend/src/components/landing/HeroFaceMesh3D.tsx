import React, { useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const HeroFaceMesh3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGSAP(
    () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // ─── Three.js Scene Setup ───
      const scene = new THREE.Scene();
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || 600;

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(0, 0, 5.5);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // ─── Anatomical 3D Biometric Face Mesh Construction ───
      // We generate a high-definition parametric 3D face topography:
      // Grid dimensions: rows (vertical slices) × cols (horizontal arcs)
      const rows = 32;
      const cols = 28;
      const totalVertices = rows * cols;

      const basePositions = new Float32Array(totalVertices * 3);
      const currentPositions = new Float32Array(totalVertices * 3);
      const scatterPositions = new Float32Array(totalVertices * 3);
      const indices: number[] = [];

      let vIdx = 0;
      for (let r = 0; r < rows; r++) {
        // v ranges from 1.2 (top of head/forehead) to -1.3 (base of chin/jaw)
        const v = 1.2 - (r / (rows - 1)) * 2.5;

        // Calculate horizontal width at this height
        let horizontalSpan = 1.25;
        if (v > 0.6) {
          // Forehead / cranium curvature
          horizontalSpan = 1.15 * Math.sin(Math.PI * 0.5 + (v - 0.6) * 1.2);
        } else if (v < -0.3) {
          // Jaw / chin taper
          horizontalSpan = 1.25 - ((-0.3 - v) / 1.0) * 0.82;
        }

        for (let c = 0; c < cols; c++) {
          // u ranges from -1 (left temple/cheek) to +1 (right temple/cheek)
          const u = -1.0 + (c / (cols - 1)) * 2.0;

          // Base cylindrical / ellipsoidal head coordinates
          const theta = u * (Math.PI * 0.42); // 75-degree frontal face curvature
          let x = Math.sin(theta) * horizontalSpan * 1.35;
          let y = v * 1.45;
          let z = Math.cos(theta) * 0.95 - 0.35;

          // ─── Anatomical Feature Relief Equations ───
          const absX = Math.abs(x);

          // 1. Nose Bridge & Nose Tip
          const noseYDist = Math.abs(y - (-0.05));
          if (absX < 0.35 && y > -0.45 && y < 0.45) {
            const noseProfile = Math.max(0, 1 - absX / 0.28);
            const noseElevation = Math.max(0, 1 - noseYDist / 0.45);
            // Strong projection for nose tip around y = -0.15
            const tipBoost = Math.exp(-((x * x * 25) + ((y + 0.15) * (y + 0.15) * 35))) * 0.65;
            z += (noseProfile * noseElevation * 0.75) + tipBoost;
          }

          // 2. Eye Sockets (orbital depressions)
          const eyeCenterX = 0.46;
          const eyeCenterY = 0.26;
          const leftEyeDist = Math.hypot(x - eyeCenterX, y - eyeCenterY);
          const rightEyeDist = Math.hypot(x + eyeCenterX, y - eyeCenterY);
          const minEyeDist = Math.min(leftEyeDist, rightEyeDist);
          if (minEyeDist < 0.32) {
            const eyeHollow = (1 - minEyeDist / 0.32) * 0.32;
            z -= eyeHollow;
          }

          // 3. Eyebrow Ridges (supraorbital arch)
          const browCenterY = 0.42;
          const browDist = Math.min(
            Math.hypot(x - 0.48, y - browCenterY),
            Math.hypot(x + 0.48, y - browCenterY)
          );
          if (browDist < 0.38) {
            z += Math.exp(-(browDist * browDist * 16)) * 0.26;
          }

          // 4. Cheekbones (zygomatic arch)
          const cheekDist = Math.min(
            Math.hypot(x - 0.75, y - (-0.05)),
            Math.hypot(x + 0.75, y - (-0.05))
          );
          if (cheekDist < 0.45) {
            z += Math.exp(-(cheekDist * cheekDist * 10)) * 0.28;
          }

          // 5. Mouth & Lips
          const mouthY = -0.48;
          if (absX < 0.48 && Math.abs(y - mouthY) < 0.22) {
            // Upper and lower lip ridges
            const lipRelief = Math.exp(-((x * x * 14) + ((y - mouthY) * (y - mouthY) * 45))) * 0.32;
            // Labial fissure separation
            const fissure = Math.exp(-((y - mouthY) * (y - mouthY) * 200)) * 0.08;
            z += lipRelief - fissure;
          }

          // 6. Chin (Mental Protuberance)
          const chinY = -0.98;
          const chinDist = Math.hypot(x, y - chinY);
          if (chinDist < 0.42) {
            z += Math.exp(-(chinDist * chinDist * 12)) * 0.38;
          }

          // 7. Cranium Depth & Lateral Head Rounding
          if (y > 0.6) {
            z -= (y - 0.6) * 0.25;
          }

          // Store Base Geometry
          const i3 = vIdx * 3;
          basePositions[i3] = x;
          basePositions[i3 + 1] = y;
          basePositions[i3 + 2] = z;

          currentPositions[i3] = x;
          currentPositions[i3 + 1] = y;
          currentPositions[i3 + 2] = z;

          // Generate 512D Scatter Positions (downward stream into Pipeline)
          const scatterAngle = Math.random() * Math.PI * 2;
          const scatterRadius = 1.8 + Math.random() * 3.8;
          scatterPositions[i3] = Math.cos(scatterAngle) * scatterRadius;
          scatterPositions[i3 + 1] = y * 0.5 - (Math.random() * 5.0 + 1.5);
          scatterPositions[i3 + 2] = Math.sin(scatterAngle) * scatterRadius + (Math.random() - 0.5) * 2.5;

          vIdx++;
        }
      }

      // Generate Quad-to-Triangle indices for the facial grid
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = r * cols + c;
          const b = r * cols + (c + 1);
          const d = (r + 1) * cols + c;
          const e = (r + 1) * cols + (c + 1);

          indices.push(a, b, d);
          indices.push(b, e, d);
        }
      }

      // ─── Three.js Geometries & Materials ───
      const faceGeo = new THREE.BufferGeometry();
      faceGeo.setAttribute("position", new THREE.BufferAttribute(currentPositions, 3));
      faceGeo.setIndex(indices);
      faceGeo.computeVertexNormals();

      // Glowing circular point texture for landmark nodes
      const makeNodeTexture = () => {
        const size = 64;
        const cvs = document.createElement("canvas");
        cvs.width = size;
        cvs.height = size;
        const c = cvs.getContext("2d")!;
        const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, "rgba(0, 223, 216, 1)");
        grad.addColorStop(0.3, "rgba(0, 112, 243, 0.8)");
        grad.addColorStop(0.7, "rgba(6, 182, 212, 0.2)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        c.fillStyle = grad;
        c.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(cvs);
      };

      // 1. Biometric Point Landmarks (512D Vector Nodes)
      const pointsMat = new THREE.PointsMaterial({
        size: 0.075,
        map: makeNodeTexture(),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pointsMesh = new THREE.Points(faceGeo, pointsMat);

      // 2. Cyan Wireframe Facial Mesh Overlay
      const wireframeGeo = new THREE.WireframeGeometry(faceGeo);
      const wireframeMat = new THREE.LineBasicMaterial({
        color: 0x00dfd8,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const wireframeLines = new THREE.LineSegments(wireframeGeo, wireframeMat);

      // 3. Highlighted Facial Landmark Features (Eyes, Nose, Mouth Loop Points)
      // Highlight landmark nodes with a brighter cyan/emerald accent
      const landmarkIndices = [
        // Pupils & Eyes
        11 * cols + 8, 11 * cols + 19, 12 * cols + 7, 12 * cols + 20,
        // Nose Tip & Bridge
        15 * cols + 13, 15 * cols + 14, 17 * cols + 13, 17 * cols + 14,
        // Lip Contours
        21 * cols + 13, 21 * cols + 14, 23 * cols + 11, 23 * cols + 16,
        // Chin Apex & Jaw Angles
        28 * cols + 13, 28 * cols + 14, 25 * cols + 4, 25 * cols + 23,
      ];

      const landmarkPos = new Float32Array(landmarkIndices.length * 3);
      const landmarkGeo = new THREE.BufferGeometry();
      landmarkGeo.setAttribute("position", new THREE.BufferAttribute(landmarkPos, 3));

      const landmarkMat = new THREE.PointsMaterial({
        size: 0.12,
        color: 0x34d399,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const landmarkMesh = new THREE.Points(landmarkGeo, landmarkMat);

      // Grouping
      const faceGroup = new THREE.Group();
      faceGroup.add(pointsMesh);
      faceGroup.add(wireframeLines);
      faceGroup.add(landmarkMesh);
      faceGroup.position.set(0, 0.05, 0);
      scene.add(faceGroup);

      // ─── GSAP ScrollTrigger Integration ───
      const scrollAnim = {
        progress: 0,
      };

      // Entrance Reveal Animation
      gsap.fromTo(
        faceGroup.scale,
        { x: 0.6, y: 0.6, z: 0.6 },
        { x: 1, y: 1, z: 1, duration: 1.4, ease: "power3.out" }
      );
      gsap.fromTo(
        wireframeMat,
        { opacity: 0 },
        { opacity: 0.32, duration: 1.2, ease: "power2.out" }
      );

      // Scroll-Linked Dissolve Timeline
      const st = ScrollTrigger.create({
        trigger: container,
        start: "top 20%",
        end: "bottom top",
        scrub: 1.2,
        onUpdate: (self) => {
          scrollAnim.progress = self.progress;
        },
      });

      // ─── Render Loop ───
      let animationFrameId: number;
      let isTabActive = true;

      const render = (time: number) => {
        if (!isTabActive) return;

        const t = time * 0.001;
        const p = scrollAnim.progress;

        // Ambient Head Movement (Scanning sweep & gentle bob)
        faceGroup.rotation.y = Math.sin(t * 0.6) * 0.22 + p * 0.75;
        faceGroup.rotation.x = Math.sin(t * 0.4) * 0.08 - p * 0.25;
        faceGroup.position.y = 0.05 + Math.sin(t * 0.7) * 0.06 - p * 1.6;

        // Wireframe fades as mesh deconstructs into 512D vectors
        wireframeMat.opacity = Math.max(0, 0.32 * (1 - p * 2.4));
        landmarkMat.opacity = Math.max(0, 1.0 * (1 - p * 1.8));
        pointsMat.size = 0.075 + p * 0.045;
        pointsMat.opacity = Math.max(0.15, 0.95 * (1 - p * 0.35));

        // Vertex interpolation from structured Face → Dispersed Vector Cloud
        const pos = faceGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < totalVertices; i++) {
          const i3 = i * 3;
          pos[i3] = basePositions[i3] * (1 - p) + scatterPositions[i3] * p;
          pos[i3 + 1] = basePositions[i3 + 1] * (1 - p) + scatterPositions[i3 + 1] * p;
          pos[i3 + 2] = basePositions[i3 + 2] * (1 - p) + scatterPositions[i3 + 2] * p;
        }
        faceGeo.attributes.position.needsUpdate = true;

        // Update key landmark points
        const lmPos = landmarkGeo.attributes.position.array as Float32Array;
        for (let k = 0; k < landmarkIndices.length; k++) {
          const idx = landmarkIndices[k] * 3;
          lmPos[k * 3] = pos[idx];
          lmPos[k * 3 + 1] = pos[idx + 1];
          lmPos[k * 3 + 2] = pos[idx + 2] + 0.02;
        }
        landmarkGeo.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(render);
      };

      animationFrameId = requestAnimationFrame(render);

      // Resize Handler
      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || 600;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      // Tab Visibility Handler
      const handleVisibilityChange = () => {
        isTabActive = !document.hidden;
        if (isTabActive) {
          animationFrameId = requestAnimationFrame(render);
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        st.kill();
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("visibilitychange", handleVisibilityChange);

        // Cleanup WebGL Geometries & Materials
        faceGeo.dispose();
        wireframeGeo.dispose();
        landmarkGeo.dispose();
        pointsMat.dispose();
        wireframeMat.dispose();
        landmarkMat.dispose();
        renderer.dispose();
      };
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="hero-3d-canvas-container" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-3d-webgl-canvas" />
    </div>
  );
};
