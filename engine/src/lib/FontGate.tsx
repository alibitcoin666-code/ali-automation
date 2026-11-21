import React, { useEffect, useState } from "react";
import { fontsLoaded, fontsReady } from "./fonts";

/**
 * Renders children only after every brand font is loaded, so text measurement
 * (measureText / layoutText) never runs against a fallback face.
 */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(fontsLoaded());
  useEffect(() => {
    if (!ready) fontsReady.then(() => setReady(true));
  }, [ready]);
  return ready ? <>{children}</> : null;
};

export function gated<P extends object>(C: React.ComponentType<P>): React.FC<P> {
  const G: React.FC<P> = (props) => (
    <FontGate>
      <C {...props} />
    </FontGate>
  );
  G.displayName = `Gated(${C.displayName ?? C.name})`;
  return G;
}
