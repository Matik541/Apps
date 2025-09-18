
let renderCanvas = $('#render')[0],
    renderCtx = renderCanvas.getContext('2d'),
    color = 0;

renderCanvas.width = 1000
renderCanvas.height = 1000

let angle = 30

var global = {
    x: 400,
    y: 200,
    z: 0
}


var iso = {
    makeIso(x, y, z) {
        let isoX = (x - z) * Math.cos(angle * Math.PI / 180);
        let isoY = y + (x + z) * Math.sin(angle * Math.PI / 180);
        return [isoX, isoY];
    },
    moveTo(x, y, z) {
        let [isoX, isoY] = this.makeIso(x, y, z);
        renderCtx.moveTo(isoX, isoY);
    },
    lineTo(x, y, z) {
        let [isoX, isoY] = this.makeIso(x, y, z);
        renderCtx.lineTo(isoX, isoY);
    }
}

class Cube {
    constructor(x, z, width, height, depth, slice = "T", axis = 'x') {
        this.x = x;
        this.z = z;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.slice = slice;
        this.axis = axis;
    }

    begin() {
        return { x: this.x, z: this.z }
    }
    dim() {
        return { x: this.width, y: this.height, z: this.depth }
    }
}

function cropCardboard(cardboard, axis = 'x') {
    let cubes = [];

    // make a few cubes to represent the cardboard 1 for bot and number of tooths + 2 (margin ones) is equal to number of cubes for top
    let w = cardboard.width;
    let d = cardboard.gap;

    if (axis == 'z') {
        w = cardboard.gap;
        d = cardboard.width;
    }

    let x = -cardboard.margin;
    let z = -cardboard.margin;

    if (axis == 'x')
        cubes.push(new Cube(x, 0, w, cardboard.depth / 2, d, 'T', axis));
    else
        cubes.push(new Cube(0, z, w, cardboard.depth / 2, d, 'B', axis));



    let h = cardboard.depth / 2;


    for (let i = 0; i < cardboard.tooths.length + 2; i++) {
        let tooth = cardboard.margin;
        if (i > 0 && i <= cardboard.tooths.length) tooth = cardboard.tooths[i - 1];

        if (axis == 'x') {
            cubes.push(new Cube(x, 0, tooth, h, d, 'B', axis));
            x += tooth + cardboard.gap;
        }
        else {
            cubes.push(new Cube(0, z, w, h, tooth, 'T', axis));
            z += tooth + cardboard.gap;
        }
    }

    return cubes;
}

let walls = [
    // new Cube(0, 0, 50, 50, 50, 'B', 'x'),
]
walls = walls.concat(cropCardboard(cardboards[0], 'x'))
walls = walls.concat(cropCardboard(cardboards[1], 'z'))

console.log(walls);


function render() {

    renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    renderCtx.strokeStyle = 'black';



    for (let wall of walls) {
        b = wall.begin();
        d = wall.dim();

        g = global;

        let side = 0;
        if (wall.slice == 'B') side = wall.height;

        renderCtx.beginPath();

        iso.moveTo(g.x + b.x, g.y + side, g.z + b.z);
        iso.lineTo(g.x + b.x + d.x, g.y + side, g.z + b.z);
        iso.lineTo(g.x + b.x + d.x, g.y + side, g.z + b.z + d.z);
        iso.lineTo(g.x + b.x, g.y + side, g.z + b.z + d.z);
        iso.lineTo(g.x + b.x, g.y + side, g.z + b.z);
        
        iso.moveTo(g.x + b.x + d.x, g.y + side, g.z + b.z);
        iso.lineTo(g.x + b.x + d.x, g.y + d.y + side, g.z + b.z);
        iso.lineTo(g.x + b.x + d.x, g.y + d.y + side, g.z + b.z + d.z);
        iso.lineTo(g.x + b.x, g.y + d.y + side, g.z + b.z + d.z);
        iso.lineTo(g.x + b.x, g.y + side, g.z + b.z + d.z);
        iso.lineTo(g.x + b.x, g.y + side, g.z + b.z);
        
        iso.moveTo(g.x + b.x + d.x, g.y + side, g.z + b.z + d.z);
        iso.lineTo(g.x + b.x + d.x, g.y + d.y + side, g.z + b.z + d.z);

        renderCtx.fillStyle = wall.axis == 'x' ? '#CD9F61' : '#C08F4F'; // #A97835 #C08F4F #CD9F61
        renderCtx.fill();
        renderCtx.stroke();
    }






}

render();
setInterval(render, 1000 / 30);
