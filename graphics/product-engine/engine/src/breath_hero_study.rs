//! Isolated character art direction. Not registered in the product scene until approved.
//! The two authored poses share their head, neck, shoulders and hand gesture.
//! Opaque silhouettes are painted before their contour; there are no joint rings.
use std::fmt::Write;

#[derive(Clone, Copy)]
pub enum Pose {
    Stand,
    Step,
}

pub struct Contour {
    pub d: String,
    pub width: f32,
    pub ink: f32,
    pub opaque: bool,
}

fn line(d: &str, width: f32, ink: f32) -> Contour {
    Contour {
        d: d.into(),
        width,
        ink,
        opaque: false,
    }
}

fn shape(d: &str, width: f32, ink: f32) -> Contour {
    Contour {
        d: d.into(),
        width,
        ink,
        opaque: true,
    }
}

// The skull, jaw and neck belong to the torso silhouette. This removes the
// detached neck/collar construction of the earlier procedural rig.
const UPPER: &str = "M 151 149
 C 160 145 165 140 165 130
 C 156 124 152 114 150 103
 C 148 91 149 78 154 69
 C 160 59 171 56 182 58
 C 193 60 200 66 201 76
 C 202 82 200 87 199 91
 C 199 94 201 98 203 101
 L 208 106 Q 210 109 206 110
 L 202 111 Q 202 113 204 114
 L 200 115 Q 198 117 202 118
 Q 204 120 201 124
 C 197 129 190 129 185 128
 C 183 135 184 144 188 149
 C 192 154 202 156 209 163
 C 215 169 215 180 211 190
 C 208 198 208 204 210 211
 C 212 219 209 226 204 231
 C 198 236 194 244 193 253
 C 192 268 201 281 207 292
 C 214 305 215 319 211 332";

const RETURN: &str = "
 C 163 337 148 329 141 318
 C 132 304 138 288 144 275
 C 150 261 152 252 149 241
 C 145 229 141 218 140 205
 C 139 195 136 187 133 179
 C 128 169 130 160 139 155
 C 143 153 147 151 151 149 Z";

const STAND_LEG: &str = "
 C 209 350 204 372 200 394
 C 197 411 196 426 196 440
 C 198 453 195 466 192 479
 C 188 496 184 524 178 546
 C 176 563 176 580 178 591
 C 181 598 189 602 197 607
 C 201 609 207 610 212 612
 Q 218 614 217 619
 Q 216 623 209 623
 L 188 623 C 181 623 175 620 168 618
 Q 160 618 160 611
 C 161 600 161 590 161 578
 C 160 563 159 546 160 531
 C 162 510 166 491 168 472
 C 169 459 170 448 169 436
 C 165 418 162 397 162 378
 C 162 361 166 349 171 340";

const STEP_LEG: &str = "
 C 207 349 231 371 244 390
 C 254 408 263 424 266 438
 C 270 454 270 470 271 486
 C 273 512 278 538 285 561
 C 290 575 295 586 300 590
 C 306 594 314 594 320 592
 Q 328 589 331 594
 Q 333 598 326 603
 C 317 609 308 613 298 614
 L 285 615 Q 277 615 277 607
 C 276 595 272 583 266 571
 C 255 548 245 523 241 498
 C 239 480 237 463 230 451
 C 215 433 199 415 185 394
 C 174 379 167 360 171 340";

pub fn contours(pose: Pose) -> Vec<Contour> {
    let mut out = Vec::with_capacity(20);
    // Far leg: a single anatomical contour with a relaxed knee, not a tube rig.
    out.push(shape(
        match pose {
            Pose::Stand => {
                "M 146 307 C 138 331 135 357 138 381
 C 140 402 146 418 145 437 C 144 455 135 470 132 487
 C 128 507 129 530 127 548 C 125 565 122 581 123 590
 C 124 597 128 603 134 606 C 140 610 146 612 148 615
 Q 151 619 145 621 C 135 622 123 620 113 616
 Q 105 613 108 603 C 112 586 112 566 112 550
 C 112 528 111 508 115 485 C 118 465 121 449 119 432
 C 116 411 116 388 118 368 C 120 343 127 320 137 305 Z"
            }
            Pose::Step => {
                "M 145 308 C 138 335 138 361 136 382
 C 133 407 124 427 108 446 C 97 460 87 470 81 484
 C 71 509 59 539 45 564 C 40 575 35 585 36 591
 C 37 597 47 600 55 602 Q 65 605 62 610
 Q 60 614 51 614 C 39 615 30 613 20 610
 Q 12 607 15 599 C 18 590 22 580 25 570
 C 31 550 36 528 44 506 C 51 485 61 466 73 449
 C 82 436 88 421 93 404 C 101 375 109 339 128 310 Z"
            }
        },
        1.65,
        0.66,
    ));
    // Far arm and relaxed hand. Fingers taper together into the silhouette.
    out.push(shape(
        "M 137 161 C 125 163 120 175 117 188
 C 114 202 112 217 106 232 C 101 245 99 258 99 274
 L 99 308 C 99 317 95 325 95 334
 C 95 343 97 350 101 355 Q 104 358 105 354
 L 103 342 L 108 358 Q 111 361 112 357 L 109 340
 L 115 356 Q 119 359 118 353 L 115 336
 L 121 347 Q 125 349 124 343
 C 124 334 119 328 118 321 C 117 317 120 314 120 310
 L 119 272 C 119 259 121 248 125 237
 C 132 222 138 205 142 189 C 146 176 145 166 137 161 Z",
        1.65,
        0.8,
    ));
    out.push(shape(
        &format!(
            "{UPPER}{}{RETURN}",
            match pose {
                Pose::Stand => STAND_LEG,
                Pose::Step => STEP_LEG,
            }
        ),
        1.8,
        1.0,
    ));
    // A small tied-back silhouette, no strand texture or realistic rendering.
    out.push(shape(
        "M 148 89 C 142 85 135 88 134 95
 C 132 103 136 111 143 112 Q 149 111 150 105",
        1.5,
        0.84,
    ));
    out.push(line("M 153 84 C 159 76 170 71 183 71", 1.0, 0.42));
    out.push(line(
        "M 160 105 C 157 98 162 94 166 97
 C 170 100 167 105 164 107",
        1.0,
        0.72,
    ));
    out.push(line("M 190 94 Q 194 96 197 94", 1.0, 0.86));
    out.push(line(
        "M 171 130 C 171 140 174 151 179 157
 M 183 139 Q 181 149 179 157
 M 146 158 Q 162 157 177 160
 M 184 159 Q 194 158 201 162",
        1.05,
        0.72,
    ));
    // A few directional anatomy lines. The silhouette does most of the work.
    out.push(line(
        "M 143 192 C 146 206 154 215 166 218
 M 176 222 C 183 229 195 231 202 225
 M 178 247 Q 176 256 178 262
 M 158 291 Q 166 299 170 311",
        1.05,
        0.62,
    ));
    // Near arm rises from the shoulder into a gently bent elbow and a chest hand.
    out.push(shape(
        "M 201 165 C 212 163 219 174 221 187
 C 224 201 227 215 231 228 C 234 239 230 249 223 251
 C 216 252 211 247 207 241
 C 194 225 185 209 179 196
 C 176 191 171 187 167 184
 Q 163 181 163 177 Q 164 175 167 177 L 174 183
 L 164 169 Q 162 166 164 164 Q 167 163 170 167 L 181 180
 L 171 163 Q 169 159 172 159 Q 175 159 177 163 L 188 178
 L 180 164 Q 178 160 181 161 Q 184 162 186 167 L 193 180
 L 189 169 Q 188 165 191 166 Q 194 167 196 174
 L 199 186 C 201 193 198 197 201 202
 C 206 210 212 218 217 224
 C 211 211 207 201 204 193
 C 199 182 195 174 201 165 Z",
        1.7,
        0.97,
    ));
    out.push(line(
        "M 179 196 Q 184 197 189 193
 M 212 236 Q 215 240 220 241
 M 202 174 Q 209 176 211 183",
        0.95,
        0.55,
    ));
    // Knees are implied by one crease. No joint seam, muscle stripes or sockets.
    out.push(line(
        match pose {
            Pose::Stand => {
                "M 182 436 Q 186 441 185 449
 M 135 435 Q 132 441 133 446
 M 169 584 Q 169 593 172 596"
            }
            Pose::Step => {
                "M 251 435 Q 255 441 255 448
 M 94 447 Q 88 450 86 457
 M 280 581 Q 283 590 287 593"
            }
        },
        0.95,
        0.51,
    ));
    out
}

pub fn svg(pose: Pose) -> String {
    let mut svg = String::from("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 350 670\"><g stroke-linecap=\"round\" stroke-linejoin=\"round\">");
    for c in contours(pose) {
        let r = (231. * c.ink) as u8;
        let g = (225. * c.ink) as u8;
        let _ = write!(
            svg,
            "<path d=\"{}\" fill=\"{}\" stroke=\"#{r:02x}{g:02x}00\" stroke-width=\"{}\"/>",
            c.d,
            if c.opaque { "#000" } else { "none" },
            c.width
        );
    }
    svg.push_str("</g></svg>");
    svg
}
