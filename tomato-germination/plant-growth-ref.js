var p1;
var p2;
var p3;
var newGrassColour;
var grassColour;
var stemColour;
var nodeAngle = 0.1;
var branchingAngle = 0.5;
var trendUpward = 0.5;
var minBranchLength = 15;
var leafLikelihood = 0.75;
var maxTrunkWidth = 40;
var trunkTaper = 0.9;
var border = 0;
var angleMod = 0;
var angles = [];

function setup() {
  createCanvas(displayWidth, 400);
  frameRate(60);
  newGrassColour = color(200, 255, 200);
  grassColour = color(100, 150, 50);
  stemColour = color(150, 100, 50);
  p1 = new Plant(400 * random(0.2, 0.5), height);
  p2 = new Plant(400 * random(0.5, 0.8), height);
  p3 = new Plant(400 * 0.75, height);
  for (var i = 0; i < PI * 2; i += 0.05) {
    angles.unshift(sin(i) * 0.02);
  }
}

function draw() {
  background(255);
  angleMod = noise(frameCount / 100) * 0.1;
  // background(220)
  noStroke();
  fill(220);
  border += 0.015;
  border = min(border, 400 / 3);
  rect(border, border, 400 - border * 2, 400 - border);
  // p1.update();
  // p1.draw();
  // p2.update();
  // p2.draw();
  p3.update();
  p3.draw();
}

class Plant {
  constructor(x, y) {
    this.age = 0;
    this.pos = createVector(x, y);
    this.nodes = [];
    this.nodes.push(new Stem(this, this, -PI / 2, 1));
    this.width = maxTrunkWidth / trunkTaper;
  }
  update() {
    for (var i = 0; i < this.nodes.length; i++) {
      this.nodes[i].update((i + frameCount) % angles.length);
    }
    this.nodes.length = min(1000, this.nodes.length);
  }
  draw() {
    for (let n of this.nodes) {
      n.draw();
    }
  }
}

class Node {
  constructor(root, parent, angle, stemChance) {
    this.root = root;
    this.parent = parent;
    // angle = (angle % (PI*2));
    // let targetUp = (angle < PI/2 ? PI*1.5 : -PI*1.5)
    // this.angle = lerp(angle,targetUp,trendUpward);
    this.angle = angle;
    this.stemChance = stemChance;
    this.pos = parent.pos.copy();
    this.length = 1;
    this.width = 1;
    this.hasSplit = false;
  }
  update() {}
  clampToScreen() {
    this.pos.x = min(max(this.pos.x, this.width), width - this.width);
    this.pos.y = min(max(this.pos.y, this.width), height - this.width);
  }
  split() {}
  draw() {}
}

class Leaf extends Node {
  constructor(root, parent, angle, stemChance) {
    super(root, parent, angle, stemChance);
    this.angle += random(PI * 2);
  }
  update(ang) {
    // this.length = min(10, this.length + 1 / this.length);
    this.length = lerp(this.length, 10, 0.01);
    this.width = this.length * 0.8;
    this.pos = this.parent.pos.copy().add(
      createVector(1, 1)
        .setMag(this.length)
        .setHeading(this.angle + angles[ang])
    );
    this.clampToScreen();
  }
  draw() {
    strokeWeight(this.width * 2);
    stroke(lerpColor(newGrassColour, grassColour, this.length / 10));
    line(this.parent.pos.x, this.parent.pos.y, this.pos.x, this.pos.y);
  }
}

class Stem extends Node {
  constructor(root, parent, angle, stemChance) {
    super(root, parent, angle, stemChance);
    // console.log(this.root.nodes)
    root.nodes.push(
      new Leaf(this.root, this, this.angle, this.stemChance * leafLikelihood)
    );
  }
  update(ang) {
    this.length = min(this.length + random(0.75, 1.25) / this.length, 60);
    this.width = min(
      this.parent.width * trunkTaper,
      this.width + 1 / (this.width * 50)
    );
    this.pos = this.parent.pos.copy().add(
      createVector(1, 1)
        .setMag(this.length)
        .setHeading(this.angle + angles[ang])
    );
    this.clampToScreen();
    if (
      (!this.hasSplit && this.length > minBranchLength) ||
      random() > 0.9995
    ) {
      this.hasSplit = true;
      this.split();
    }
  }
  split() {
    let branchAngle = this.angle + random(-nodeAngle, nodeAngle);
    for (var i = 0; i < random(1, 3); i++) {
      this.root.nodes.push(
        random() > this.stemChance
          ? new Leaf(
              this.root,
              this,
              branchAngle + random(-branchingAngle, branchingAngle),
              this.stemChance * leafLikelihood
            )
          : new Stem(
              this.root,
              this,
              branchAngle + random(-branchingAngle, branchingAngle),
              this.stemChance * leafLikelihood
            )
      );
    }
    // this.root.nodes.push(new Stem(this.root, this, branchAngle));
  }
  draw() {
    strokeWeight(this.width);
    stroke(
      lerpColor(newGrassColour, stemColour, this.length / minBranchLength)
    );
    line(this.parent.pos.x, this.parent.pos.y, this.pos.x, this.pos.y);
  }
}
