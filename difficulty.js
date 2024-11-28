import fs from 'fs';
import path from 'path';

const readFile = (filePath) => {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, filePath)).toString());
};

class Wall {
  constructor(beat, duration, height, width, column) {
    this.time = time(beat);
    this.endTime = time(beat + duration);
    this.wallType = wallType(height, width, column);
  }
};

class Bomb {
  constructor(beat, columnNumber, rowNumber) {
    this.time = time(beat);
    this.column = columns[columnNumber];
    this.row = rows[rowNumber];
  };
};

class Note {
  constructor(handNumber, beat, columnNumber, rowNumber, directionNumber, chainData, startArc, endArc) {
    this.hand = handNumber ? "right" : "left";
    this.time = time(beat);
    this.column = columns[columnNumber];
    this.row = rows[rowNumber];
    this.direction = directions[directionNumber];
    this.chainData = chainData;
    this.arcData = {
      startArc: startArc,
      endArc: endArc,
    };
  };
};

const info = readFile("Info.json");
const mapData = readFile("ExpertPlusStandard.json");

let bpm = info._beatsPerMinute;
const mapObjects = [];

let version;
if (mapData.version) {
  version = mapData.version[0]
} else {
  version = mapData._version[0]
}

const legacy = version < 3;
const meta = version > 3;

const beatLabel = legacy ? '_time' : 'b' ;
const columnLabel = legacy ? '_lineIndex' : 'x';
const rowLabel = legacy ? '_lineLayer' : 'y';
const colorLabel = legacy ? '_type' : 'c';
const directionLabel = legacy ? '_cutDirection' : 'd';
const durationLabel = legacy ? '_duration' : 'd';
const widthLabel = legacy ? '_width' : 'w';
const heightLabel = legacy ? '_height' : 'h';

const directions = {
  0: "u",
  1: "d",
  2: "l",
  3: "r", 
  4: "ul",
  5: "ur",
  6: "dl",
  7: "dr",
  8: "a",
};

const columns = {
  0: "outleft",
  1: "inleft",
  2: "inright",
  3: "outright",
};

const rows = {
  0: "bottom",
  1: "middle",
  2: "top",
};

const wallType = (height, width, column) => {
  if (width === 1 && (column === 0 || column === 3)) return "decorative";
  if (height === 0 && (width > 2 || (column === 1 && width > 1))) throw new Error(`Illegal wall data detected: Height [${height}], Width [${width}], Column [${column}]`);
  if (height === 2) {
    if (column > 1) return "rightCeiling";
    if ((column === 0 && width === 2) || (column === 1 && width === 1)) return "leftCeiling";
    return "ceiling";
  }
  if (column > 1) return "right";
  return "left";
};

const time = (beat) => {
  return (beat / bpm) * 60000;
};

// Notes
for (const colorNote of mapData[legacy ? "_notes" : "colorNotes"]) {
  if (colorNote[colorLabel] === 3) {
    continue;
  }
  mapObjects.push(
    new Note(
      meta ? mapData.colorNotesData[colorNote.i][colorLabel] : colorNote[colorLabel],
      colorNote[beatLabel],
      meta ? mapData.colorNotesData[colorNote.i][columnLabel] : colorNote[columnLabel],
      meta ? mapData.colorNotesData[colorNote.i][rowLabel] : colorNote[rowLabel],
      meta ? mapData.colorNotesData[colorNote.i][directionLabel] : colorNote[directionLabel],
      null,
      false,
      false
    )
  );
};

// Arcs & Chains
if (version >= 3) {
  let noteIndex = 0;
  let backIndex = 0;
  for (const arc of mapData[meta ? "arcs" : "sliders"]) {
    while (mapObjects[noteIndex].time <= time(arc.tb)) {
      if (
        mapObjects[noteIndex].time === time(arc.tb) &&
        mapObjects[noteIndex].row === rows[meta ? mapData.colorNotesData[arc.ti].y : arc.ty] &&
        mapObjects[noteIndex].column === columns[meta ? mapData.colorNotesData[arc.ti].x : arc.tx] &&
        mapObjects[noteIndex].hand === ((meta ? mapData.colorNotesData[arc.ti].c : arc.c) ? "right" : "left")
      ) {
        mapObjects[noteIndex].arcData.endArc = true;
        backIndex = noteIndex - 1;
        break;
      } else {
        noteIndex++;
      };
    };
    while (mapObjects[backIndex]?.time >= time(arc.b)) {
      if (
        mapObjects[backIndex]?.time === time(meta ? arc.hb : arc.b) &&
        mapObjects[backIndex]?.row === rows[meta ? mapData.colorNotesData[arc.hi].y : arc.y] &&
        mapObjects[backIndex]?.column === columns[meta ? mapData.colorNotesData[arc.hi].x : arc.x] &&
        mapObjects[backIndex]?.hand === ((meta ? mapData.colorNotesData[arc.hi].c : arc.c) ? "right" : "left")
      ) {
        mapObjects[backIndex].arcData.startArc = true;
        break;
      } else {
        backIndex--;
      };
    }
  };

  noteIndex = 0;
  toNextChain: for (const chain of mapData[meta ? "chains" : "burstSliders"]) {
    while (mapObjects[noteIndex].time <= time(meta ? chain.hb : chain.b)) {
      if (
        mapObjects[noteIndex].time === time(meta ? chain.hb : chain.b) &&
        mapObjects[noteIndex].row === rows[meta ? mapData.colorNotesData[chain.i].y : chain.y] &&
        mapObjects[noteIndex].column === columns[meta ? mapData.colorNotesData[chain.i].x :chain.x] &&
        mapObjects[noteIndex].hand === ((meta ? mapData.colorNotesData[chain.i].c : chain.c) ? "right" : "left")
      ) {
        mapObjects[noteIndex].chainData = {
          endChain: time(chain.tb),
          endDirection: directions[meta ? mapData.chainsData[chain.ci].d : chain.d],
          endColumn: columns[meta ? mapData.chainsData[chain.ci].tx : chain.tx],
          endRow: rows[meta ? mapData.chainsData[chain.ci].ty : chain.ty],
          links: meta ? mapData.chainsData[chain.ci].c : chain.sc,
          size: meta ? mapData.chainsData[chain.ci].s : chain.s,
        };
        continue toNextChain;
      } else {
        noteIndex++;
      }
    };
    throw new Error("Chain with no head detected");
  };
}

// Bombs
for (const bombNote of mapData[legacy ? "_notes" : "bombNotes"]) {
  if (legacy && bombNote._type !== 3) {
    continue;
  }
  mapObjects.push(
    new Bomb(
      bombNote[beatLabel],
      meta ? mapData.bombNotesData[bombNote.i][columnLabel] : bombNote[columnLabel],
      meta ? mapData.bombNotesData[bombNote.i][rowLabel] : bombNote[rowLabel]
    )
  );
};

// Walls
for (const obstacle of mapData[legacy ? "_obstacles" : "obstacles"]) {
  mapObjects.push(
    new Wall(
      obstacle[beatLabel],
      meta ? mapData.obstaclesData[obstacle.i][durationLabel] : obstacle[durationLabel],
      meta ? mapData.obstaclesData[obstacle.i][heightLabel] : obstacle[heightLabel],
      meta ? mapData.obstaclesData[obstacle.i][widthLabel] : obstacle[widthLabel],
      meta ? mapData.obstaclesData[obstacle.i][columnLabel] : obstacle[columnLabel]
    )
  );
};

mapObjects.sort((a, b) => a.time - b.time)

// Factors
const absoluteDirectionPenalty = Math.sqrt(2);
const relativeDirectionPenalty = Math.cbrt(2);
const absoluteHorizontalPenalty = Math.pow(2, 0.25);
const absoluteVerticalPenalty = Math.cbrt(2);
const relativeHorizontalPenalty = Math.cbrt(2);
const relativeVerticalPenalty = Math.sqrt(2); 

const factorAbsolutePosition = (noteGroup) => {
  const leftColumnMultiplier = {
    outleft: 1,
    inleft: 0,
    inright: 1,
    outright: 2,
  }
  const rightColumnMultiplier = {
    outleft: 2,
    inleft: 1,
    inright: 0,
    outright: 1,
  }
  const rowMultiplier = {
    top: 2,
    middle: 1,
    bottom: 0,
  }
  for (const note of noteGroup) {
    if (note.hand === "left") note.difficulty *= Math.pow(absoluteHorizontalPenalty, leftColumnMultiplier[note.column])
    if (note.hand === "right") note.difficulty *= Math.pow(absoluteHorizontalPenalty, rightColumnMultiplier[note.column])
    note.difficulty *= Math.pow(absoluteVerticalPenalty, rowMultiplier[note.row])
  }
  // const swingDirections = {
  //   left: "a",
  //   right: "a",
  // }
  // for (const note of noteGroup) {
  //   if (swingDirections[note.hand] !== note.direction && note.direction !== "a") {
  //     if (swingDirections[note.hand] === "a") {
  //       swingDirections[note.hand] = note.direction
  //     } else throw new Error("Invalid arrow combination detected");
  //   }
  // }
}

// Find an object's local context and run its difficult factors
let leftHand;
let rightHand;

mapObjects.forEach((object, index, array) => {
  if (object instanceof Note && !object.difficulty) {
    const noteGroup = [];
    // Calculate the noteGroup (other notes within 33ms) and otherContext (all nearby walls and bombs)
    for (let i = 0; array[index + i]?.time - object.time <= 100 / 3; i++) {
      if (array[index + i] instanceof Note) {
        array[index + i].difficulty = 1;
        noteGroup.push(array[index + i])
      }
    }
    factorAbsolutePosition(noteGroup);
    // factorAbsoluteDirection(noteGroup);
    // factorRelativeDirection(noteGroup);
  }
})

// console.log(mapObjects)

let skill = 1;

const skillCurve = (num) => {
  return num>=0?((-1/(2**num)+1)+1)/2:(-(-1/(2**-num)+1)+1)/2;
}

// FC Chance

const fakeObjects = [];

for (let i = 0; i < 100; i++) {
  fakeObjects.push({difficulty: 2});
}

for (let i = 0; i < 10; i++) {
  fakeObjects.push({difficulty: 10});
}

for (let i = 0; i < 64; i++) {
  let fcChance = 1;
  for (const object of fakeObjects) {
    const chance = skillCurve(skill - object.difficulty);
    fcChance *= chance
  }
  fcChance > 0.5 ? skill -= 2**(6-i) : skill += 2**(6-i);
}

console.log("FULL CLEAR: " + skill);

// Survival Chance

skill = 1;
const basicQuantumHealth = [];

for (let i = 0; i < 101; i++) {
  basicQuantumHealth.push(0);
}

for (let i = 0; i < 64; i++) {
  let quantumHealth = basicQuantumHealth.slice();
  quantumHealth[100] = 1;

  for (const object of fakeObjects) {
    const newQuantumHealth = basicQuantumHealth.slice();
    newQuantumHealth[0] = quantumHealth[0];
    for (let j = 1; j < 101; j++) {
      const chance = skillCurve(skill - object.difficulty);
      if (j - 15 < 0) newQuantumHealth[0] += quantumHealth[j] * (1 - chance);
      else newQuantumHealth[j - 15] += quantumHealth[j] * (1 - chance);
      if (j === 100) newQuantumHealth[100] += quantumHealth[j] * chance;
      else newQuantumHealth[j + 1] += quantumHealth[j] * chance;
    }
    // console.log(newQuantumHealth);
    quantumHealth = newQuantumHealth.slice();
  }
  // console.log(quantumHealth.reduce((acc, curr) => acc + curr))
  quantumHealth[0] <= 0.5 ? skill -= 2**(6-i) : skill += 2**(6-i);
}

console.log("SURVIVAL:    " + skill);

// for (const object of mapObjects) {
//   console.log("Difficulty: " + object.difficulty)
//   const chance = (-1/2**(skill/object.difficulty)) + 1;
//   console.log("Chance: " + chance);
//   fcChance *= chance ? chance : 1;
//   console.log(fcChance);
// }