import type { Attributes } from 'graphology-types';
import { EdgeProgram, type ProgramInfo } from 'sigma/rendering';
import type { EdgeDisplayData, NodeDisplayData, RenderParams } from 'sigma/types';
import { floatColor } from 'sigma/utils';

/**
 * A dashed straight edge — how the knowledge map draws an unlinked mention, so
 * it never reads as a real link. Sigma 3 ships no dashed program; this is its
 * `EdgeRectangleProgram` with one addition: the vertex shader passes the
 * distance along the edge in screen pixels, and the fragment shader drops every
 * other 4px of it. The period is in pixels, not graph units, so the dash looks
 * the same at every zoom level. Picking (hover detection) stays solid.
 */

const VERTEX_SHADER = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_normal;
attribute float a_normalCoef;
attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute float a_positionCoef;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_zoomRatio;
uniform float u_pixelRatio;
uniform float u_correctionRatio;
uniform float u_minEdgeThickness;
uniform float u_feather;
uniform vec2 u_resolution;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;
varying float v_distance;

const float bias = 255.0 / 254.0;

void main() {
  vec2 normal = a_normal * a_normalCoef;
  vec2 position = a_positionStart * (1.0 - a_positionCoef) + a_positionEnd * a_positionCoef;

  float normalLength = length(normal);
  vec2 unitNormal = normal / normalLength;
  float pixelsThickness = max(normalLength, u_minEdgeThickness * u_sizeRatio);
  float webGLThickness = pixelsThickness * u_correctionRatio / u_sizeRatio;

  gl_Position = vec4((u_matrix * vec3(position + unitNormal * webGLThickness, 1)).xy, 0, 1);

  // Edge length on screen, in CSS pixels: clip space spans 2 units per viewport.
  vec2 start = (u_matrix * vec3(a_positionStart, 1)).xy;
  vec2 end = (u_matrix * vec3(a_positionEnd, 1)).xy;
  v_distance = a_positionCoef * length((end - start) * u_resolution * 0.5);

  v_thickness = webGLThickness / u_zoomRatio;
  v_normal = unitNormal;
  v_feather = u_feather * u_correctionRatio / u_zoomRatio / u_pixelRatio * 2.0;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif

  v_color.a *= bias;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;
varying float v_distance;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
const float dashPeriod = 8.0;
const float dashLength = 4.0;

void main(void) {
  #ifdef PICKING_MODE
  gl_FragColor = v_color;
  #else
  if (mod(v_distance, dashPeriod) > dashLength) discard;
  float dist = length(v_normal) * v_thickness;
  float t = smoothstep(v_thickness - v_feather, v_thickness, dist);
  gl_FragColor = mix(v_color, transparent, t);
  #endif
}
`;

const { UNSIGNED_BYTE, FLOAT } = WebGLRenderingContext;
const UNIFORMS = [
  'u_matrix',
  'u_zoomRatio',
  'u_sizeRatio',
  'u_correctionRatio',
  'u_pixelRatio',
  'u_feather',
  'u_minEdgeThickness',
  'u_resolution',
] as const;

export default class DashedEdgeProgram<
  N extends Attributes = Attributes,
  E extends Attributes = Attributes,
  G extends Attributes = Attributes,
> extends EdgeProgram<(typeof UNIFORMS)[number], N, E, G> {
  getDefinition() {
    return {
      VERTICES: 6,
      VERTEX_SHADER_SOURCE: VERTEX_SHADER,
      FRAGMENT_SHADER_SOURCE: FRAGMENT_SHADER,
      METHOD: WebGLRenderingContext.TRIANGLES,
      UNIFORMS,
      ATTRIBUTES: [
        { name: 'a_positionStart', size: 2, type: FLOAT },
        { name: 'a_positionEnd', size: 2, type: FLOAT },
        { name: 'a_normal', size: 2, type: FLOAT },
        { name: 'a_color', size: 4, type: UNSIGNED_BYTE, normalized: true },
        { name: 'a_id', size: 4, type: UNSIGNED_BYTE, normalized: true },
      ],
      CONSTANT_ATTRIBUTES: [
        { name: 'a_positionCoef', size: 1, type: FLOAT },
        { name: 'a_normalCoef', size: 1, type: FLOAT },
      ],
      CONSTANT_DATA: [[0, 1], [0, -1], [1, 1], [1, 1], [0, -1], [1, -1]],
    };
  }

  processVisibleItem(edgeIndex: number, startIndex: number, sourceData: NodeDisplayData, targetData: NodeDisplayData, data: EdgeDisplayData) {
    const thickness = data.size || 1;
    const dx = targetData.x - sourceData.x;
    const dy = targetData.y - sourceData.y;
    let length = dx * dx + dy * dy;
    let n1 = 0;
    let n2 = 0;
    if (length) {
      length = 1 / Math.sqrt(length);
      n1 = -dy * length * thickness;
      n2 = dx * length * thickness;
    }
    const array = this.array;
    array[startIndex++] = sourceData.x;
    array[startIndex++] = sourceData.y;
    array[startIndex++] = targetData.x;
    array[startIndex++] = targetData.y;
    array[startIndex++] = n1;
    array[startIndex++] = n2;
    array[startIndex++] = floatColor(data.color);
    array[startIndex++] = edgeIndex;
  }

  setUniforms(params: RenderParams, { gl, uniformLocations }: ProgramInfo<(typeof UNIFORMS)[number]>) {
    gl.uniformMatrix3fv(uniformLocations.u_matrix, false, params.matrix);
    gl.uniform1f(uniformLocations.u_zoomRatio, params.zoomRatio);
    gl.uniform1f(uniformLocations.u_sizeRatio, params.sizeRatio);
    gl.uniform1f(uniformLocations.u_correctionRatio, params.correctionRatio);
    gl.uniform1f(uniformLocations.u_pixelRatio, params.pixelRatio);
    gl.uniform1f(uniformLocations.u_feather, params.antiAliasingFeather);
    gl.uniform1f(uniformLocations.u_minEdgeThickness, params.minEdgeThickness);
    gl.uniform2f(uniformLocations.u_resolution, params.width, params.height);
  }
}
