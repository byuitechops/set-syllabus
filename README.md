# Set Syllabus
### *Package Name*: set-syllabus
### *Child Type*: post-import
### *Platform*: online
### *Required*: Required

This child module is built to be used by the Brigham Young University - Idaho D2L to Canvas Conversion Tool. It utilizes the standard `module.exports => (course, stepCallback)` signature and uses the Conversion Tool's standard logging functions. You can view extended documentation [Here](https://github.com/byuitechops/d2l-to-canvas-conversion-tool/tree/master/documentation).

## Purpose
It moves the course syllabus from the pages to the syllabus module.

## How to Install
npm install set-syllabus

## Run Requirements
Does not apply

## Options
Does not apply

## Outputs
The course changed in resetting the syllabus

## Process
The steps: 
1. get modules
2. get all items 
3. either find syllabus or there is no syllabus
4. process the syllabus if found or return 'syllabus not found' if not
5. delete the old syllabus item from modules

## Log Categories
Does not apply

## Requirements
If the courser syllabus is among modules, the step finds it 
and rellocates it into the Sullabus folder of the course
(it handles both, the url and the html cases for the syllabus).