import * as THREE from 'three';

export class GoAnimations {
    constructor() {
        this.ease = t => -(Math.cos(Math.PI * t) - 1) / 2;
    }

    update(board) {
        this.handleCameraTransition(board);
        this.handleGhostStone(board);
        this.handleStonePhysics(board);
    }

    handleCameraTransition(board) {
        if (!board.isTransitioning) {
            if (!board.is2D) board.controls.update();
            return;
        }

        const t = Math.min(1, (performance.now() - board.transitionStart) / 350);
        const eased = this.ease(t);
        
        const dPos = board.is2D ? board.pos2D : board.saved3DPos;
        const dTgt = board.is2D ? board.target2D : board.saved3DTarget;
        const dQuat = board.is2D ? board.quat2D : board.saved3DQuat;

        board.camera.position.lerpVectors(board.startPos, dPos, eased);
        board.controls.target.lerpVectors(board.startTarget, dTgt, eased);
        board.camera.quaternion.copy(board.startQuat.clone().slerp(dQuat, eased));

        if (t >= 1) {
            board.camera.position.copy(dPos);
            board.controls.target.copy(dTgt);
            board.camera.quaternion.copy(dQuat);
            if (board.is2D) {
                board.sync2DCamera();
                board.setActiveCamera(board.orthoCamera);
            }
            board.isTransitioning = false;
            board.controls.enabled = !board.is2D;
        }
    }

    handleGhostStone(board) {
        if (!board.ghostStone) return;
        const interactionGame = board.getInteractionGame ? board.getInteractionGame() : board.game;

        const canShowGhost = board.hoverI >= 0 && 
                           board.hoverJ >= 0 && 
                           board.isHumanTurn() &&
                           interactionGame.isLegalMove(board.hoverI, board.hoverJ) &&
                           !board.isTransitioning;

        if (canShowGhost) {
            board.ghostStone.visible = true;
            board.ghostStone.material = interactionGame.currentPlayer === 1 ? board.ghostBlackMat : board.ghostWhiteMat;
            board.ghostStone.position.set(
                board.worldOffset + board.hoverI * board.worldStep, 
                board.baseY, 
                board.worldOffset + board.hoverJ * board.worldStep
            );

            if (board.isCharging) {
                const charge = 2.0 * (1 - Math.exp(-2.5 * ((performance.now() - board.chargeStart) / 370)));
                board.ghostStone.position.y += 0.5 + charge * 2;
            }
        } else {
            board.ghostStone.visible = false;
        }
    }

    handleStonePhysics(board) {
        board.stones.forEach(s => {
            // Slamming logic
            if (s.slamY > s.basey) {
                s.slamY -= 0.5;
                if (s.slamY <= s.basey) {
                    s.slamY = s.basey;
                    this.triggerRattle(board, s);
                }
                s.mesh.position.y = s.slamY;
                return;
            }

            // Rattling logic
            if (s.rattleEnergy > 0.0001) {
                const stiffness = 0.4 + s.rattleEnergy * 0.2;
                const noise = 0.02 * s.rattleEnergy;
                
                s.vx += -s.offsetX * stiffness + (Math.random() - 0.5) * noise;
                s.vy += -s.offsetY * stiffness + (Math.random() - 0.5) * noise;
                s.vz += -s.offsetZ * stiffness + (Math.random() - 0.5) * noise;
                
                s.vx *= 0.75; s.vz *= 0.75; s.vy *= 0.375;
                s.offsetX += s.vx; s.offsetY += s.vy; s.offsetZ += s.vz;
                
                s.mesh.position.set(s.basex + s.offsetX, s.basey + s.offsetY, s.basez + s.offsetZ);
                s.mesh.rotation.x += s.vx * 0.2;
                s.mesh.rotation.z += s.vz * 0.2;
                s.rattleEnergy *= 0.96;
            } else {
                s.offsetX = s.offsetY = s.offsetZ = s.vx = s.vy = s.vz = 0;
                s.mesh.position.set(s.basex, s.basey, s.basez);
            }
        });
    }

    triggerRattle(board, droppedStone) {
        if (droppedStone.power > 0.15) {
            droppedStone.rattleEnergy = Math.max(droppedStone.rattleEnergy, droppedStone.power * 1.2);
            board.stones.forEach(other => {
                if (other !== droppedStone) {
                    const distSq = Math.pow(other.i - droppedStone.i, 2) + Math.pow(other.j - droppedStone.j, 2);
                    other.rattleEnergy = Math.max(other.rattleEnergy, (droppedStone.power * 0.8) / (distSq + 1));
                }
            });
        } else {
            droppedStone.rattleEnergy = Math.max(droppedStone.rattleEnergy, 0.5);
        }
    }
}
