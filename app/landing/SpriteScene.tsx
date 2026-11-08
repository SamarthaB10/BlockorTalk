'use client';

import { useEffect, useRef, useState } from 'react';
import { spriteFrames, type Folder, type Personality } from '../../lib/sprites.mjs';

/** Original opaque sprite canvases are displayed intact on a black collectible display. */
export default function SpriteScene({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void import('three').then(THREE => {
      if (disposed || !host.current) return;
      const parent = host.current;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch { return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      parent.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
      scene.add(new THREE.HemisphereLight(0xfff6ee, 0xd9d2c8, 2));
      const key = new THREE.DirectionalLight(0xfff3e6, 3);
      key.position.set(-3, 5, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0005;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xfff0e6, 1.2); rim.position.set(4, 2, -4); scene.add(rim);
      const fill = new THREE.PointLight(0xff9a6a, 8, 12); fill.position.set(-3.2, 1.2, .6); scene.add(fill);
      const object = new THREE.Group(); scene.add(object);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.6, 1.7), new THREE.MeshStandardMaterial({ color:0x292826, roughness:.9 }));
      plinth.position.y = -1.95; plinth.castShadow = true; plinth.receiveShadow = true; object.add(plinth);
      const canvas = document.createElement('canvas'); canvas.width = 340; canvas.height = 290;
      const context = canvas.getContext('2d');
      if (!context) { renderer.dispose(); renderer.domElement.remove(); return; }
      context.imageSmoothingEnabled = false; context.fillStyle = '#000'; context.fillRect(0,0,340,290);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.LinearFilter;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.9), new THREE.MeshBasicMaterial({ map:texture, toneMapped:false }));
      screen.position.set(0,.38,.16); object.add(screen);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.48,2.98,.12),new THREE.MeshStandardMaterial({color:0x171717,roughness:.4,metalness:.15}));
      back.position.set(0,.38,.06); back.castShadow=true; object.add(back);
      const ringCanvas=document.createElement('canvas');ringCanvas.width=512;ringCanvas.height=16;
      const ringContext=ringCanvas.getContext('2d');
      if(ringContext){const g=ringContext.createLinearGradient(0,0,512,0);g.addColorStop(0,'#ffb347');g.addColorStop(.4,'#ff8a3d');g.addColorStop(1,'#ff3d8b');ringContext.fillStyle=g;ringContext.fillRect(0,0,512,16);}
      const ringTexture=new THREE.CanvasTexture(ringCanvas);ringTexture.colorSpace=THREE.SRGBColorSpace;
      const trim=new THREE.Mesh(new THREE.BoxGeometry(3.48,.035,.14),new THREE.MeshBasicMaterial({map:ringTexture,toneMapped:false}));trim.position.set(0,1.87,.1);object.add(trim);
      const poses: {personality:Personality;folder:Folder}[] = [{personality:'planner',folder:'idle'},{personality:'planner',folder:'talk_standard'}];
      const images=poses.map(p=>spriteFrames(p.personality,p.folder).map(src=>{const image=new Image();image.src=src;return image;}));
      const reduced=matchMedia('(prefers-reduced-motion: reduce)');
      const still = () => paused || reduced.matches;
      let frame=0,progress=0,pointerX=0,pointerY=0,mouseX=0,mouseY=0,lastDraw='',lastTime=0,signaled=false;
      const slot=document.querySelector<HTMLElement>('[data-scene-slot]');
      let lastWidth=0,lastHeight=0;
      const place=()=>{
        if(!slot){parent.style.visibility='hidden';return undefined;}
        const rect=slot.getBoundingClientRect();
        if(rect.width<2||rect.height<2){parent.style.visibility='hidden';return undefined;}
        const sections=Array.from(document.querySelectorAll<HTMLElement>('.nova-section'));
        const first=sections[0], last=sections[sections.length-1];
        let travel=0;
        if(first&&last){
          const start=first.offsetTop;
          const end=last.offsetTop+last.offsetHeight-innerHeight;
          travel=Math.max(0,Math.min(1,(scrollY-start)/Math.max(1,end-start)));
        }
        const shift=(travel-.5)*Math.min(innerHeight*.42,280);
        parent.style.visibility='visible';
        parent.style.transform=`translate3d(${rect.left}px,${rect.top+shift}px,0)`;
        parent.style.width=`${rect.width}px`;parent.style.height=`${rect.height}px`;
        if(rect.width!==lastWidth||rect.height!==lastHeight){
          lastWidth=rect.width;lastHeight=rect.height;
          camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
          renderer.setSize(rect.width,rect.height);
        }
        return travel;
      };
      const resize=()=>{lastWidth=0;place();};
      const pointer=(event:PointerEvent)=>{mouseX=event.clientX/innerWidth*2-1;mouseY=event.clientY/innerHeight*2-1;};
      const draw=(time:number)=>{
        if(disposed)return;
        frame=requestAnimationFrame(draw);
        if(document.hidden || time-lastTime<32)return;
        lastTime=time;
        const target=place();if(target===undefined)return;progress=still()?target:progress+(target-progress)*.1;
        pointerX+=(mouseX-pointerX)*.06;pointerY+=(mouseY-pointerY)*.06;
        const phase=progress>.62?1:0;
        const index=still()?0:Math.floor(time/125)%images[phase].length;
        const image=images[phase][index],drawKey=`${phase}/${index}`;
        if(image.complete&&image.naturalWidth&&lastDraw!==drawKey){context.drawImage(image,0,0,340,290);texture.needsUpdate=true;lastDraw=drawKey;if(!signaled){signaled=true;setReady(true);}}
        const blend=Math.min(1,progress);const ease=blend*blend*(3-2*blend);
        const distance=Math.max(10.5,8/camera.aspect);
        camera.position.set(still()?0:pointerX*.18,1.1+ease*.2,distance-ease*.3);
        camera.lookAt(0,-.2,0);
        object.position.x=0;
        object.position.y=still()?0:Math.sin(time*.0014)*.02;
        object.rotation.y=-.28+ease*.22+(still()?0:pointerX*.07);
        object.rotation.z=still()?0:Math.sin(time*.0007)*.012;
        camera.position.y-=still()?0:pointerY*.05;
        renderer.render(scene,camera);
      };
      resize();window.addEventListener('resize',resize);window.addEventListener('pointermove',pointer,{passive:true});
      frame=requestAnimationFrame(draw);
      cleanup=()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);texture.dispose();ringTexture.dispose();scene.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
    }).catch(()=>{});
    return()=>{disposed=true;cleanup();};
  },[paused]);
  return <div ref={host} className="nova-scene" data-ready={ready} aria-hidden="true"/>;
}
