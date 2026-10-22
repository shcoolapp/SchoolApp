import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createDoorScene } from './engine';

// The animated door. Control it through a ref: play() while waiting, then success(cb) or fail().
const DoorScene = forwardRef(function DoorScene(_props, ref) {
  const host = useRef(null);
  const scene = useRef(null);

  useEffect(() => {
    scene.current = createDoorScene(host.current);
    return () => {
      scene.current.destroy();
      scene.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => scene.current?.play(),
    success: (cb) => (scene.current ? scene.current.success(cb) : cb && cb()),
    fail: () => scene.current?.fail(),
    reset: () => scene.current?.reset()
  }), []);

  return <div ref={host} className="door-scene" />;
});

export default DoorScene;
