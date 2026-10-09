// A mask of the person in a photo, from macOS's subject lifting (Vision), for
// profile pictures whose background can't be cut out by colour.
//   swift scripts/mask.swift brand/source/photo.png brand/source/photo-mask.png
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

let args = CommandLine.arguments
guard args.count == 3 else {
  print("usage: swift scripts/mask.swift photo.png mask.png")
  exit(1)
}
guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
  let photo = CGImageSourceCreateImageAtIndex(src, 0, nil)
else {
  print("can't read \(args[1])")
  exit(1)
}

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: photo, options: [:])
try handler.perform([request])
guard let subjects = request.results?.first else {
  print("no subject found in \(args[1])")
  exit(1)
}

// Every subject it found, at the photo's size, as an 8-bit grey PNG (white = keep).
let matte = try subjects.generateScaledMaskForImage(forInstances: subjects.allInstances, from: handler)
let rect = CGRect(x: 0, y: 0, width: photo.width, height: photo.height)
guard let out = CIContext().createCGImage(CIImage(cvPixelBuffer: matte), from: rect, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray()),
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)
else {
  print("can't write \(args[2])")
  exit(1)
}
CGImageDestinationAddImage(dest, out, nil)
CGImageDestinationFinalize(dest)
print("wrote \(args[2]) (\(photo.width)×\(photo.height), \(subjects.allInstances.count) subject(s))")
