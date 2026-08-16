import { floatVal } from '../util/helpers'
import { models } from '../models/js13k-2026'
import { getTextureByIndex } from '../textures'
// W is defined globally in w.js

type CubeDef = [
    string,
    string, // type, name
    number,
    number,
    number, // width, height, depth
    number,
    number,
    number, // x, y, z
    number,
    number,
    number, // rx, ry, rz
    number,
    number,
    number, // ox, oy, oz
    number, // color index
]

type Model = (CubeDef | CubeDef[])[]

const BB_PALETTE_KEYS = ['Light Blue', 'Yellow', 'Orange', 'Red', 'Purple', 'Blue', 'Green', 'Lime', 'Pink', 'Silver']

const expandCubeDef = (item: CubeDef): CubeDef => {
    const [shape, name, width, height, depth, x, y, z, rX, rY, rZ, oX, oY, oZ, texIdx] = item
    // Pyramid width is one side, cylinder radius is the hypotenuse
    const widthNum = floatVal(width)
    const heightNum = floatVal(height)
    const depthNum = floatVal(depth)
    const xNum = floatVal(x)
    const yNum = floatVal(y)
    const zNum = floatVal(z)
    const rXNum = floatVal(rX)
    const rYNum = floatVal(rY)
    const rZNum = floatVal(rZ)
    const oXNum = floatVal(oX)
    const oYNum = floatVal(oY)
    const oZNum = floatVal(oZ)
    const textureIndex = texIdx !== undefined ? floatVal(texIdx) : null
    return [
        shape,
        name,
        widthNum,
        heightNum,
        depthNum,
        xNum,
        yNum,
        zNum,
        rXNum,
        rYNum,
        rZNum,
        oXNum,
        oYNum,
        oZNum,
        textureIndex,
    ]
}

// Shared parse geometry functions
const parsePyramidGeometry = (item: CubeDef): THREE.BufferGeometry => {
    const [shape, name, width, height, depth, x, y, z, rX, rY, rZ, oX, oY, oZ, textureIndex] = expandCubeDef(item)
    // Pyramid width is one side, cylinder radius is the hypotenuse

    const radius = Math.sqrt(width * width + width * width) / 2
    const geometry = new THREE.CylinderGeometry(0, radius, height, 4, 1, false, Math.PI / 4)
    geometry.scale(1, 1, depth / width)
    // Three origin is midpoint, Blockbench origin is center of mass (lower 3 vs 1.2)
    geometry.translate(x - oX, y - oY + 0.3 * height, z - oZ)
    geometry.rotateX(rX)
    geometry.rotateY(rY)
    geometry.rotateZ(rZ)
    return geometry
}

const parseCubeGeometry = (item: CubeDef): THREE.BufferGeometry => {
    const [shape, name, width, height, depth, x, y, z, rX, rY, rZ, oX, oY, oZ, color] = expandCubeDef(item)

    const geometry = new THREE.BoxGeometry(width, height, depth)
    geometry.translate(x - oX, y - oY, z - oZ)
    geometry.rotateX(rX)
    geometry.rotateY(rY)
    geometry.rotateZ(rZ)

    geometry.computeBoundingBox()
    return geometry
}

const parseSphereGeometry = (item: CubeDef): THREE.BufferGeometry => {
    const [shape, name, width, height, depth, x, y, z, rX, rY, rZ, oX, oY, oZ, color] = expandCubeDef(item)

    const geometry = new THREE.SphereGeometry(width / 2, 32, 16)
    geometry.scale(width / width, height / width, depth / width)
    geometry.translate(x - oX, y - oY, z - oZ)
    geometry.rotateX(rX)
    geometry.rotateY(rY)
    geometry.rotateZ(rZ)
    return geometry
}

const parsePlaneGeometry = (item: CubeDef): THREE.BufferGeometry => {
    const [shape, name, width, height, depth, x, y, z, rX, rY, rZ, oX, oY, oZ, color] = expandCubeDef(item)

    const geometry = new THREE.PlaneGeometry(width, height)
    // Three planes are upright, Blockbench planes are horizontal
    geometry.rotateX(-90)
    geometry.translate(x - oX, y - oY, z - oZ)
    geometry.rotateX(rX)
    geometry.rotateY(rY)
    geometry.rotateZ(rZ)
    geometry.computeBoundingBox()
    return geometry
}

const parseCylinderGeometry = (item: CubeDef): THREE.BufferGeometry => {
    const [shape, name, width, height, depth, x, y, z, rX, rY, rZ, oX, oY, oZ, color] = expandCubeDef(item)

    const radius = width / 2
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 32)
    geometry.translate(x - oX, y - oY, z - oZ)
    geometry.scale(1, 1, depth / width)
    const qX = rX
    const qY = rY
    const qZ = rZ
    const rotEuler = new THREE.Euler(qX, qY, qZ)
    geometry.applyQuaternion(new THREE.Quaternion().setFromEuler(rotEuler))
    geometry.computeBoundingBox()
    return geometry
}

// Shape code to geometry parser mapping
const SHAPE_PARSERS = {
    c: parseCubeGeometry,
    s: parseSphereGeometry,
    p: parsePlaneGeometry,
    cy: parseCylinderGeometry,
    py: parsePyramidGeometry,
} as const

// Helper function to parse geometry from item string
const parseGeometry = (item: CubeDef): THREE.BufferGeometry => {
    const [shape] = item
    const parser = SHAPE_PARSERS[shape as keyof typeof SHAPE_PARSERS]

    if (!parser) {
        throw new Error(`Unknown shape: ${shape}`)
    }

    return parser(item)
}

const builtinShapes = {
    'c': W.cube,
    'p': W.plane,
    'b': W.billboard,
    'py': W.pyramid,
    's': W.sphere,
    'cy': W.cylinder,
}

// Uses W rather than THREE to create a model from a model array.
export const loadModel = (modelName: keyof typeof models) => {
    const modelArray = models[modelName]

    const parentName = `${String(modelName)}_${Math.random().toString(36).substring(2, 15)}`
    W.group({ n: parentName, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 })

    modelArray.forEach((item: CubeDef, index: number) => {
        if (item === null) {
            console.error('ITEM IS NULL')
            return
        }
        const [shape, name, w, h, d, x, y, z, rx, ry, rz, oX, oY, oZ, textureIndex] = expandCubeDef(item)
        const n = `${parentName}_${index}`
        const g = parentName
        const settings = { n, g, w, h, d, x, y, z, rx, ry, rz }
        if (textureIndex !== null) {
            settings.t = getTextureByIndex(textureIndex)
        }
        if (shape.startsWith('g_')) {
            const nestedName = shape.slice(2) as keyof typeof models
            const prefabName = loadModel(nestedName)
            // Keep an eye on rotation, there might be something different between Blockbench and W.
            W.move({ n: prefabName, g: parentName, x, y, z, rx: -rx, ry, rz })
        } else if (Object.keys(builtinShapes).includes(shape)) {
            const builtinShape = builtinShapes[shape as keyof typeof builtinShapes]
            builtinShape(settings)
        }
    })

    W.move({ n: parentName, z: -20 })
    return parentName
}
