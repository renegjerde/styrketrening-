import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js";

const viewport=document.getElementById("anatomy3dViewport");
const status=document.getElementById("anatomy3dStatus");
if(viewport){
 const scene=new THREE.Scene(); scene.background=new THREE.Color("#151d2d");
 const camera=new THREE.PerspectiveCamera(35,1,.01,100); camera.position.set(0,1.05,3.2);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; viewport.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xeaf2ff,0x293448,2.1));
 const key=new THREE.DirectionalLight(0xffffff,3.0); key.position.set(2,3,4);scene.add(key);
 const fill=new THREE.DirectionalLight(0x9bb9e8,1.2);fill.position.set(-3,1,-3);scene.add(fill);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.target.set(0,.9,0);controls.minDistance=1.4;controls.maxDistance=5.5;controls.enablePan=false;
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const modelUrl="https://raw.githubusercontent.com/Charleeh/ecorche/main/model/ecorche.meshopt.glb";
 let root=null,showSkeleton=false; const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 function resize(){const w=viewport.clientWidth||320,h=viewport.clientHeight||430;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(viewport);resize();
 loader.load(modelUrl,gltf=>{
  root=gltf.scene;scene.add(root);
  root.traverse(o=>{if(!o.isMesh)return;const layer=o.userData.layer||"";if(layer==="skeleton")o.visible=showSkeleton;
    if(layer==="superficial muscles"||layer==="deep muscles"){o.material=o.material.clone();o.material.side=THREE.DoubleSide;}
  });
  // Model root units are authored at 0.0001 scale; normalize to a convenient viewer height.
  const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  root.position.sub(center);root.scale.multiplyScalar(1.75/Math.max(size.y,.01));root.position.y=.88;
  controls.target.set(0,.88,0);camera.position.set(0,1.0,3.15);controls.update();
  if(status)status.remove();
 },undefined,error=>{if(status)status.textContent="Kunne ikke laste 3D-modellen. Kontroller nettforbindelsen og prøv å oppdatere siden.";console.error(error);});
 function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
 renderer.domElement.addEventListener("pointerup",e=>{if(!root)return;const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(root,true).find(h=>h.object.isMesh);if(hit){const name=hit.object.userData.name||hit.object.name||"Muskel";const el=document.getElementById("anatomySelected");if(el)el.textContent=name;}});
 const musclesBtn=document.getElementById("anatomyMuscles"),bothBtn=document.getElementById("anatomyBoth");
 function layers(skeleton){showSkeleton=skeleton;if(root)root.traverse(o=>{if(o.isMesh&&(o.userData.layer||"")==="skeleton")o.visible=skeleton;});musclesBtn?.classList.toggle("active",!skeleton);bothBtn?.classList.toggle("active",skeleton);}
 musclesBtn?.addEventListener("click",()=>layers(false));bothBtn?.addEventListener("click",()=>layers(true));
}
