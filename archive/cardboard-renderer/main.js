
function $(selector) {
    return document.querySelectorAll(selector);
}

class Cardboard {
    constructor(name, width, depth, tooths, gap = 3, margin = 10) {
        this.name = name;
        this.width = width;
        this.depth = depth;
        this.tooths = tooths;
        this.gap = gap;
        this.margin = margin;
    }
    toString() {
        return this.name;
    }
}

var cardboards = [
    new Cardboard("17NAC", 390, 205, [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 3, 9.5),
    new Cardboard("3NAC", 390, 205, [185, 185], 3, 5.5),
]