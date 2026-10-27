CREATE TABLE "MuscleWorkoutDetail" (
    "id" UUID NOT NULL,
    "workoutId" UUID NOT NULL,
    "muscleGroup" VARCHAR(24) NOT NULL,
    "workingSets" INTEGER NOT NULL,
    "soreness" INTEGER NOT NULL,
    "liftName" VARCHAR(100),
    "topSetWeightKg" DECIMAL(7,2),
    "topSetReps" INTEGER,

    CONSTRAINT "MuscleWorkoutDetail_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MuscleWorkoutDetail_workingSets_check" CHECK ("workingSets" BETWEEN 1 AND 30),
    CONSTRAINT "MuscleWorkoutDetail_soreness_check" CHECK ("soreness" BETWEEN 0 AND 10),
    CONSTRAINT "MuscleWorkoutDetail_topSet_check" CHECK (
        ("liftName" IS NULL AND "topSetWeightKg" IS NULL AND "topSetReps" IS NULL) OR
        ("liftName" IS NOT NULL AND "topSetWeightKg" IS NOT NULL AND "topSetReps" IS NOT NULL)
    ),
    CONSTRAINT "MuscleWorkoutDetail_topSetWeightKg_check" CHECK ("topSetWeightKg" IS NULL OR "topSetWeightKg" > 0),
    CONSTRAINT "MuscleWorkoutDetail_topSetReps_check" CHECK ("topSetReps" IS NULL OR "topSetReps" BETWEEN 1 AND 12)
);

CREATE UNIQUE INDEX "MuscleWorkoutDetail_workoutId_muscleGroup_key"
    ON "MuscleWorkoutDetail"("workoutId", "muscleGroup");
CREATE INDEX "MuscleWorkoutDetail_muscleGroup_workoutId_idx"
    ON "MuscleWorkoutDetail"("muscleGroup", "workoutId");

ALTER TABLE "MuscleWorkoutDetail"
    ADD CONSTRAINT "MuscleWorkoutDetail_workoutId_fkey"
    FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
