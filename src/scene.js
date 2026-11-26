import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let flame1, flame2, flame3;
export let crystals, crystalModel;

export function initScene(renderer, camera) {
  const scene = new THREE.Scene();
  const gltfLoader = new GLTFLoader();

  const rgbeLoader = new RGBELoader();
  rgbeLoader.load(import.meta.env.BASE_URL + 'hdr/ferndale_studio_08_1k.hdr', (hdrTexture) => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = new THREE.Color(0x0f0c09);
    scene.environment = hdrTexture;
    buildScene(scene, camera, renderer, gltfLoader);
  });

  return scene;
}

function createCardGeometry(width, height, depth, radius, segments) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const groups = [];
  let vertexCount = 0;

  function getRoundedRectPoints(w, h, r, seg) {
    const points = [];
    const corners = [
      [w - r, h - r, 0],
      [-w + r, h - r, Math.PI * 0.5],
      [-w + r, -h + r, Math.PI],
      [w - r, -h + r, Math.PI * 1.5],
    ];
    for (const [cx, cy, startAngle] of corners) {
      for (let i = 0; i <= seg; i++) {
        const angle = startAngle + (Math.PI * 0.5 * i) / seg;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
    }
    return points;
  }

  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const seg = segments;
  const outline = getRoundedRectPoints(w, h, radius, seg);
  const N = outline.length;

  const faceStart = vertexCount;
  positions.push(0, 0, d);
  normals.push(0, 0, 1);
  uvs.push(0.5, 0.5);
  vertexCount++;

  for (let i = 0; i < N; i++) {
    const [x, y] = outline[i];
    positions.push(x, y, d);
    normals.push(0, 0, 1);
    uvs.push((x / w + 1) / 2, (y / h + 1) / 2);
    vertexCount++;
  }

  const faceIndexStart = indices.length;
  for (let i = 0; i < N; i++) {
    indices.push(faceStart, faceStart + 1 + i, faceStart + 1 + (i + 1) % N);
  }
  groups.push({ start: faceIndexStart, count: N * 3, materialIndex: 0 });

  const backStart = vertexCount;
  positions.push(0, 0, -d);
  normals.push(0, 0, -1);
  uvs.push(0.5, 0.5);
  vertexCount++;

  for (let i = 0; i < N; i++) {
    const [x, y] = outline[i];
    positions.push(x, y, -d);
    normals.push(0, 0, -1);
    uvs.push((x + w) / width, (y + h) / height);
    vertexCount++;
  }

  const backIndexStart = indices.length;
  for (let i = 0; i < N; i++) {
    indices.push(backStart, backStart + 1 + (i + 1) % N, backStart + 1 + i);
  }
  groups.push({ start: backIndexStart, count: N * 3, materialIndex: 1 });

  const sideStart = vertexCount;
  const sideIndexStart = indices.length;

  for (let i = 0; i < N; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % N];
    const nx = (x0 + x1) / 2;
    const ny = (y0 + y1) / 2;
    const len = Math.sqrt(nx * nx + ny * ny);
    positions.push(x0, y0, d, x1, y1, d, x0, y0, -d, x1, y1, -d);
    normals.push(nx/len, ny/len, 0, nx/len, ny/len, 0, nx/len, ny/len, 0, nx/len, ny/len, 0);
    uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
    const v = sideStart + i * 4;
    indices.push(v, v+1, v+2, v+1, v+3, v+2);
    vertexCount += 4;
  }

  groups.push({ start: sideIndexStart, count: indices.length - sideIndexStart, materialIndex: 2 });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  for (const g of groups) {
    geometry.addGroup(g.start, g.count, g.materialIndex);
  }
  return geometry;
}

function buildScene(scene, camera, renderer, gltfLoader) {
  console.log('buildCard开始执行');
  const loader = new THREE.TextureLoader();
  const cardBackTexture = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/card_back.jpg');
  cardBackTexture.colorSpace = THREE.SRGBColorSpace;
  const normalTexture = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/card_back_normal.png');
  const specularTexture = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/card_back_specular.png');

  const faceMaterial = new THREE.MeshStandardMaterial({
    map: cardBackTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: specularTexture,
    roughness: 0.65,
    metalness: 0.05,
    envMapIntensity: 0.1,
  });

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4c9b0,
    roughness: 0.9,
    metalness: 0,
  });

  const cardFrontTexture = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/0.jpg');
  cardFrontTexture.colorSpace = THREE.SRGBColorSpace;
  const cardFrontNormal = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/0_normal.png');
  const cardFrontSpecular = loader.load(import.meta.env.BASE_URL + 'tarot_assets/cards/0_specular.png');

  const backMaterial = new THREE.MeshStandardMaterial({
    map: cardFrontTexture,
    normalMap: cardFrontNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: cardFrontSpecular,
    roughness: 0.65,
    metalness: 0.05,
    envMapIntensity: 0.6,
  });

  console.log('即将加载GLB');
  gltfLoader.load(import.meta.env.BASE_URL + 'models/lion_paw_table.glb', (gltf) => {
    const tableModel = gltf.scene;
    console.log('模型加载成功，子物体数量：', gltf.scene.children.length);
    const box = new THREE.Box3().setFromObject(tableModel);
    const size = box.getSize(new THREE.Vector3());
    console.log('桌子尺寸：', size);
    console.log('桌子中心：', box.getCenter(new THREE.Vector3()));
    tableModel.scale.set(30, 30, 30);
    tableModel.position.set(0, 0, 0);
    const scaledBox = new THREE.Box3().setFromObject(tableModel);
    const scaledSize = scaledBox.getSize(new THREE.Vector3());
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    console.log('放大后桌子尺寸：', scaledSize);
    console.log('放大后桌子中心：', scaledCenter);
    tableModel.traverse((child) => {
      if (child.isMesh) {
        child.material.envMapIntensity = 0.8;
      }
    });
    scene.add(tableModel);

    const clothTexture = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'tarot_assets/cloth/1.jpg');
    clothTexture.colorSpace = THREE.SRGBColorSpace;
    const clothNormalTex = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'tarot_assets/cloth/cloth_normal.jpg');
    clothNormalTex.wrapS = clothNormalTex.wrapT = THREE.RepeatWrapping;
    clothNormalTex.repeat.set(2, 2);
    const clothMat = new THREE.MeshStandardMaterial({
      map: clothTexture,
      normalMap: clothNormalTex,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
    });

    gltfLoader.load(import.meta.env.BASE_URL + 'models/cloth.glb', (gltf) => {
      const clothModel = gltf.scene;
      const clothBox = new THREE.Box3().setFromObject(clothModel);
      const clothSize = clothBox.getSize(new THREE.Vector3());
      console.log('布料尺寸：', clothSize);
      clothModel.traverse((child) => {
        if (child.isMesh) {
          child.material = clothMat;
        }
      });
      clothModel.scale.set(0.4, 0.4, 0.4);
      clothModel.position.set(0, 0.8, 0);
      scene.add(clothModel);

      gltfLoader.load(import.meta.env.BASE_URL + 'models/candles.glb', (gltf) => {
        const candlesModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(candlesModel);
        const size = box.getSize(new THREE.Vector3());
        console.log('蜡烛尺寸：', size);
        candlesModel.traverse((child) => {
          if (child.isMesh) {
            child.material.envMapIntensity = 0.8;
          }
        });
        candlesModel.position.set(0.15, 2.25, -0.8);
        candlesModel.scale.set(0.3, 0.3, 0.3);
        candlesModel.rotation.y = -0.6;
        scene.add(candlesModel);

        flame1 = new THREE.PointLight(0xff8020, 6, 8);
        flame1.position.set(0.15, 2.8, -0.8);   
        scene.add(flame1);

        flame2 = new THREE.PointLight(0xff8020, 3, 5);
        flame2.position.set(-0.05, 2.55, -0.65);
        scene.add(flame2);

        flame3 = new THREE.PointLight(0xff8020, 3, 5);
        flame3.position.set(0.32, 2.52, -0.88); 
        scene.add(flame3);

        const ambientLight = new THREE.AmbientLight(0x1a0f00, 0.5);
        scene.add(ambientLight);
      }, undefined, (error) => { console.error('蜡烛加载失败：', error); });

      gltfLoader.load(import.meta.env.BASE_URL + 'models/crystal_ball.glb', (gltf) => {
        crystalModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(crystalModel);
        const size = box.getSize(new THREE.Vector3());
        console.log('水晶球尺寸：', size);
        crystalModel.traverse((child) => {
          if (child.isMesh) {
            child.material.transparent = true;
            child.material.opacity = 0.82;
            child.material.envMapIntensity = 2.0;
          }
        });
        crystalModel.scale.set(0.25, 0.25, 0.25);
        crystalModel.position.set(0.66, 2.2, -0.45);
        scene.add(crystalModel);
      }, undefined, (error) => { console.error('水晶球加载失败：', error); });

      gltfLoader.load(import.meta.env.BASE_URL + 'models/book_open.glb', (gltf) => {
        const bookOpen = gltf.scene;
        const box = new THREE.Box3().setFromObject(bookOpen);
        const size = box.getSize(new THREE.Vector3());
        console.log('book_open尺寸：', size);
        bookOpen.scale.set(0.015, 0.015, 0.015);
        bookOpen.position.set(-0.75, 1.99, -0.38);
        bookOpen.rotation.y = -0.8;
        scene.add(bookOpen);
      }, undefined, (error) => console.error('book_open加载失败：', error));

      gltfLoader.load(import.meta.env.BASE_URL + 'models/old_book_tarot.glb', (gltf) => {
        const bookTarot = gltf.scene;
        const box = new THREE.Box3().setFromObject(bookTarot);
        const size = box.getSize(new THREE.Vector3());
        console.log('old_book_tarot尺寸：', size);
        bookTarot.scale.set(0.03, 0.03, 0.03);
        bookTarot.position.set(-0.5, 2.038, -0.48);
        bookTarot.rotation.y = 1.25;
        scene.add(bookTarot);
      }, undefined, (error) => console.error('old_book_tarot加载失败：', error));

      gltfLoader.load(import.meta.env.BASE_URL + 'models/crystals.glb', (gltf) => {
        crystals = gltf.scene;
        const box = new THREE.Box3().setFromObject(crystals);
        const size = box.getSize(new THREE.Vector3());
        console.log('水晶尺寸：', size);
        crystals.scale.set(0.0035, 0.0035, 0.0035);
        crystals.position.set(-0.22, 1.99, -0.6);
        crystals.rotation.y = 2.1;
        crystals.traverse((child) => {
          if (child.isMesh) {
            const oldColor = child.material.color.clone();
            const oldMap = child.material.map;
            child.material = new THREE.MeshPhysicalMaterial({
              color: oldColor,
              map: oldMap,
              transparent: true,
              opacity: 0.9,
              roughness: 0.05,
              metalness: 0.0,
              reflectivity: 1.0,
              envMapIntensity: 4.0,
              ior: 1.8,
            });
          }
        });
        scene.add(crystals);
      }, undefined, (error) => console.error('水晶加载失败：', error));

      gltfLoader.load(import.meta.env.BASE_URL + 'models/hourglass.glb', (gltf) => {
        const hourglass = gltf.scene;
        const box = new THREE.Box3().setFromObject(hourglass);
        const size = box.getSize(new THREE.Vector3());
        console.log('沙漏尺寸：', size);
        hourglass.scale.set(0.06, 0.06, 0.06);
        hourglass.position.set(0.45, 2, -0.7);
        hourglass.rotation.y = 0.5;
        hourglass.traverse((child) => {
          if (child.isMesh) {
            child.material.envMapIntensity = 2.5;
          }
        });
        scene.add(hourglass);
      }, undefined, (error) => console.error('沙漏加载失败：', error));

      gltfLoader.load(import.meta.env.BASE_URL + 'models/ink_bottle_with_quill.glb', (gltf) => {
        const quill = gltf.scene;
        const box = new THREE.Box3().setFromObject(quill);
        const size = box.getSize(new THREE.Vector3());
        console.log('羽毛笔尺寸：', size);
        quill.scale.set(1.8, 1.8, 1.8);
        quill.position.set(0.27, 2.01, -0.4);
        quill.rotation.y = -0.8;
        scene.add(quill);
      }, undefined, (error) => console.error('羽毛笔加载失败：', error));

    }, undefined, (error) => { console.error('布料加载失败：', error); });
  }, (progress) => { console.log('加载进度：', progress); }, (error) => { console.error('桌子模型加载失败：', error); });
}
