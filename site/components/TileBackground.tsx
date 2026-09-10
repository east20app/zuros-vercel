const ROWS = 40;
const COLS = 40;

const TileBackground = () => {
    const cells = [];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            cells.push(
                <span key={`${row}-${col}`} className="tiles-cell" style={{ animationDelay: `${(row + col) * -0.13}s` }} />,
            );
        }
    }
    return (
        <div className="tiles-backdrop" aria-hidden="true">
            <div className="tiles-container">{cells}</div>
            <div className="tiles-crosses" />
            <div className="tiles-gradient" />
        </div>
    );
};

export default TileBackground;