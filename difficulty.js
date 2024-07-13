import fs from 'fs'
import path from 'path'

const readFile = (filePath) => {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, filePath)).toString())
}

const bpmInfo = readFile("BPMInfo.json")
const info = readFile("Info.json")
const mapData = readFile("ExpertPlusStandard.json")

let bpm = info._beatsPerMinute
const notes = []

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
}

const time = (beat) => {
  return (beat / bpm) * 60000
}

for (const colorNote of mapData.colorNotes) {
  notes.push({
    beat: colorNote.b,
    time: time(colorNote.b),
    column: colorNote.x,
    row: colorNote.y,
    type: colorNote.c ? "left" : "right",
    direction: directions[colorNote.d],
  })
}

for (const bombNote of mapData.bombNotes) {
  notes.push({
    beat: bombNote.b,
    time: time(bombNote.b),
    column: bombNote.x,
    row: bombNote.y,
    type: "bomb",
    direction: "a",
  })
}

console.log(notes)