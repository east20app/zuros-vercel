const SIGNALS = [
    { left: "12%", top: "18%", delay: "0s" },
    { left: "28%", top: "74%", delay: "2.4s" },
    { left: "43%", top: "34%", delay: "5.1s" },
    { left: "61%", top: "82%", delay: "1.3s" },
    { left: "76%", top: "22%", delay: "3.7s" },
    { left: "89%", top: "61%", delay: "6.2s" },
    { left: "54%", top: "13%", delay: "4.5s" },
    { left: "7%", top: "88%", delay: "7.1s" },
];

const TileBackground = () => (
    <div className="schematic-background" aria-hidden="true">
        {SIGNALS.map((signal, index) => (
            <span
                key={index}
                className="schematic-background__signal"
                style={{ left: signal.left, top: signal.top, animationDelay: signal.delay }}
            />
        ))}
    </div>
);

export default TileBackground;
